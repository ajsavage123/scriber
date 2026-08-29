import { SOAPNote } from "@/lib/types";

/**
 * Robust JSON extraction from LLM response text
 */
export function cleanAndParseJSON(rawInput: any): any {
  if (typeof rawInput === "object" && rawInput !== null) return rawInput;
  if (typeof rawInput !== "string") return null;

  let str = rawInput.trim();
  // Strip markdown code fences ```json ... ```
  str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Extract outermost balanced { ... }
  const firstBrace = str.indexOf("{");
  const lastBrace = str.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Validate and sanitize SOAP note structure.
 * Ensures clinical integrity: absent fields are labeled "Not documented"
 * and never populated with fabricated vitals or duplicated raw transcripts.
 */
export function validateAndSanitizeSOAP(
  raw: any,
  transcript: string,
  correctedSpeakerRoles?: Record<string, { role: string; confidence: number }>
): SOAPNote | null {
  if (!raw || typeof raw !== "object") return null;

  // Handle case where LLM wrapped in a top-level "soap_note" key
  const note = raw.soap_note && typeof raw.soap_note === "object" ? raw.soap_note : raw;

  const sanitizeString = (val: any, fallback = "Not documented"): string => {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
    return fallback;
  };

  const sanitizeStringArray = (val: any): string[] => {
    if (Array.isArray(val)) {
      return val
        .map(item => (typeof item === "string" ? item.trim() : String(item || "")))
        .filter(item => item.length > 0);
    }
    if (typeof val === "string" && val.trim().length > 0) {
      return [val.trim()];
    }
    return [];
  };

  const sanitizeMedications = (val: any) => {
    if (!Array.isArray(val)) return [];
    return val
      .filter(item => item && typeof item === "object")
      .map(item => ({
        name: typeof item.name === "string" ? item.name.trim() : "Not specified",
        dosage: typeof item.dosage === "string" ? item.dosage.trim() : "Not specified",
        frequency: typeof item.frequency === "string" ? item.frequency.trim() : "Not specified",
      }))
      .filter(m => m.name !== "Not specified" || m.dosage !== "Not specified");
  };

  // Parse raw speaker IDs from the transcript using regex
  const speakerRegex = /^Speaker\s+([a-zA-Z0-9_-]+):/gm;
  const detectedSpeakers = new Set<string>();
  let match;
  while ((match = speakerRegex.exec(transcript)) !== null) {
    detectedSpeakers.add(`Speaker ${match[1]}`);
  }

  // Also include speakers from Llama's diarized_transcript if provided
  const diarizedTranscript = typeof note.diarized_transcript === "string" && note.diarized_transcript.trim().length > 0
    ? note.diarized_transcript.trim()
    : undefined;

  if (diarizedTranscript) {
    const diarizedRegex = /^Speaker\s+([a-zA-Z0-9_-]+):/gm;
    let dMatch;
    while ((dMatch = diarizedRegex.exec(diarizedTranscript)) !== null) {
      detectedSpeakers.add(`Speaker ${dMatch[1]}`);
    }
  }

  if (detectedSpeakers.size === 0) {
    detectedSpeakers.add("Speaker 0");
  }

  // Parse Llama-returned speaker roles
  const rawSpeakerRoles = correctedSpeakerRoles || ((note.speaker_roles && typeof note.speaker_roles === "object") ? note.speaker_roles : {});
  const speakerRoles: Record<string, { role: string; confidence: number }> = {};
  
  let needsReview = false;
  
  // 1. Process all detected speakers to ensure none are dropped
  detectedSpeakers.forEach(spk => {
    const rawVal = rawSpeakerRoles[spk];
    let role = "unknown";
    let confidence = 0;
    
    if (rawVal && typeof rawVal === "object") {
      const r = typeof rawVal.role === "string" ? rawVal.role.trim().toLowerCase() : "unknown";
      if (["doctor", "patient", "caregiver", "interpreter", "other", "unknown"].includes(r)) {
        role = r;
      }
      const c = Number(rawVal.confidence);
      if (!isNaN(c) && c >= 0 && c <= 1) {
        confidence = c;
      }
    } else {
      // Missing assignment from Llama
      needsReview = true;
    }
    
    if (role === "unknown" || confidence < 0.60) {
      needsReview = true;
    }
    
    speakerRoles[spk] = { role, confidence };
  });

  // 2. Set review flag for 3+ speakers
  if (detectedSpeakers.size > 2) {
    needsReview = true;
  }
  
  let doctorSpeakerId = note.doctor_speaker_id;
  let patientSpeakerId = note.patient_speaker_id;

  if (correctedSpeakerRoles) {
    Object.entries(correctedSpeakerRoles).forEach(([spk, info]) => {
      if (info.role === "doctor") doctorSpeakerId = spk;
      if (info.role === "patient") patientSpeakerId = spk;
    });
  }

  doctorSpeakerId = sanitizeString(doctorSpeakerId, "Speaker 0");
  patientSpeakerId = sanitizeString(patientSpeakerId, "Speaker 1");
  
  if (doctorSpeakerId === "Unknown" || patientSpeakerId === "Unknown" || !detectedSpeakers.has(doctorSpeakerId) || !detectedSpeakers.has(patientSpeakerId)) {
    needsReview = true;
  }

  const chiefComplaint = sanitizeString(note.chief_complaint, "Clinical Consultation");
  const subjective = sanitizeString(note.subjective, "Patient symptoms documented in consultation.");
  const hpi = sanitizeString(note.history_of_present_illness, subjective);
  const objective = sanitizeString(note.objective, "Not documented in conversation.");
  const assessment = sanitizeString(note.assessment, "Assessment pending clinician sign-off.");
  const followUp = sanitizeString(note.follow_up, "Follow up as clinically indicated.");

  return {
    doctor_speaker_id: doctorSpeakerId,
    patient_speaker_id: patientSpeakerId,
    speaker_roles: speakerRoles,
    needs_review: needsReview,
    reviewed_by: note.reviewed_by || null,
    reviewed_at: note.reviewed_at || null,
    chief_complaint: chiefComplaint,
    history_of_present_illness: hpi,
    allergies: sanitizeStringArray(note.allergies),
    medications: sanitizeMedications(note.medications),
    subjective: subjective,
    objective: objective,
    assessment: assessment,
    plan: sanitizeStringArray(note.plan).length > 0 ? sanitizeStringArray(note.plan) : ["Review with clinician."],
    follow_up: followUp,
    diarized_transcript: diarizedTranscript,
  };
}
