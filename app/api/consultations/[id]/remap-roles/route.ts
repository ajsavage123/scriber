import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 1. Fetch consultation from Supabase
    const { data: consultation, error: fetchError } = await supabaseServer
      .from("consultations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !consultation) {
      return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
    }

    const transcript = consultation.diarized_transcript?.formattedTranscript;
    if (!transcript) {
      return NextResponse.json({ error: "Transcript is missing for this consultation." }, { status: 400 });
    }

    // 2. Call Llama 3.3 to remap speaker roles
    const systemPrompt = `You are a Senior Clinical AI Speaker Attribution Specialist.
Your task is to analyze the provided raw transcript of a medical encounter and determine the most likely clinical role of each distinct raw speaker ID based on the dialogue context.

Allowed roles: doctor, patient, caregiver, interpreter, other, unknown.
Do not force a speaker into doctor or patient when the conversation does not provide enough evidence.
If the role cannot be determined reliably, use 'unknown'.
Preserve the original speaker IDs exactly.

OUTPUT CONSTRAINT:
You must return a single JSON object where the keys are EXACTLY:
- doctor_speaker_id
- patient_speaker_id
- speaker_roles

The 'speaker_roles' key must map to an object where each key is a raw speaker ID (e.g. "Speaker 0", "Speaker 1") and the value is an object containing:
{
  "role": "doctor | patient | caregiver | interpreter | other | unknown",
  "confidence": number between 0 and 1
}

Do NOT add any other keys, preambles, remarks, or conversational text.`;

    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;
    const cfRes = await fetch(cfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Clinical Consultation Transcript:\n${transcript}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
    });

    if (!cfRes.ok) {
      return NextResponse.json({ error: "Failed to remap roles via Workers AI." }, { status: 502 });
    }

    const cfData = await cfRes.json();
    const rawContent = cfData.result?.response;
    
    let parsed: any = null;
    try {
      parsed = typeof rawContent === "object" ? rawContent : JSON.parse(rawContent);
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON returned by Workers AI." }, { status: 502 });
    }

    // 3. Extract unique speakers from raw transcript using regex
    const speakerRegex = /^Speaker\s+([a-zA-Z0-9_-]+):/gm;
    const detectedSpeakers = new Set<string>();
    let match;
    while ((match = speakerRegex.exec(transcript)) !== null) {
      detectedSpeakers.add(`Speaker ${match[1]}`);
    }
    if (detectedSpeakers.size === 0) {
      detectedSpeakers.add("Speaker 0");
    }

    // 4. Validate and build the updated mapping
    const rawSpeakerRoles = (parsed.speaker_roles && typeof parsed.speaker_roles === "object") ? parsed.speaker_roles : {};
    const speakerRoles: Record<string, { role: string; confidence: number }> = {};
    
    let needsReview = false;
    
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
        needsReview = true;
      }
      
      if (role === "unknown" || confidence < 0.60) {
        needsReview = true;
      }
      
      speakerRoles[spk] = { role, confidence };
    });

    if (detectedSpeakers.size > 2) {
      needsReview = true;
    }

    const doctorSpeakerId = typeof parsed.doctor_speaker_id === "string" ? parsed.doctor_speaker_id : "Speaker 0";
    const patientSpeakerId = typeof parsed.patient_speaker_id === "string" ? parsed.patient_speaker_id : "Speaker 1";

    if (doctorSpeakerId === "Unknown" || patientSpeakerId === "Unknown" || !detectedSpeakers.has(doctorSpeakerId) || !detectedSpeakers.has(patientSpeakerId)) {
      needsReview = true;
    }

    // 5. Update existing note with the new speaker role mapping
    const currentNote = consultation.final_approved_soap_note || consultation.raw_ai_soap_note;
    if (!currentNote) {
      return NextResponse.json({ error: "No clinical note exists for this consultation." }, { status: 400 });
    }

    const updatedNote = {
      ...currentNote,
      doctor_speaker_id: doctorSpeakerId,
      patient_speaker_id: patientSpeakerId,
      speaker_roles: speakerRoles,
      needs_review: needsReview,
    };

    const { data: updatedConsultation, error: patchError } = await supabaseServer
      .from("consultations")
      .update({
        final_approved_soap_note: updatedNote,
        raw_ai_soap_note: consultation.raw_ai_soap_note ? { ...consultation.raw_ai_soap_note, doctor_speaker_id: doctorSpeakerId, patient_speaker_id: patientSpeakerId, speaker_roles: speakerRoles, needs_review: needsReview } : undefined
      })
      .eq("id", id)
      .select()
      .single();

    if (patchError) {
      return NextResponse.json({ error: patchError.message }, { status: 500 });
    }

    return NextResponse.json({ consultation: updatedConsultation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
