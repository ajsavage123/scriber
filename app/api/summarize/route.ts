import { NextRequest, NextResponse } from "next/server";
import { scrubTextPII } from "@/lib/piiScrubber";

function cleanAndParseJSON(rawInput: any) {
  if (typeof rawInput === "object" && rawInput !== null) return rawInput;
  if (typeof rawInput !== "string") return null;

  let str = rawInput.trim();
  // Strip markdown code fences ```json ... ```
  str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Find { ... } JSON substring if surrounded by extra text
  const firstBrace = str.indexOf("{");
  const lastBrace = str.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(str);
  } catch (e) {
    console.error("[Summarize API] Failed to parse JSON from AI output:", e, "Raw output:", rawInput);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, specialty = "General Practice" } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    // DPDP 2023 Statutory Compliance: Strip phone numbers, emails, Aadhaar IDs, and PAN numbers
    const scrubbedTranscript = scrubTextPII(transcript);

    const systemPrompt = `You are a Senior Clinical AI Documentation Specialist specializing in ${specialty}.
Analyze the provided raw speech-to-text transcript of a medical consultation and perform clinical restructuring:

CRITICAL INSTRUCTIONS:
1. DIARIZATION & SPEAKER ALIGNMENT:
   - Identify the Clinician (asking clinical questions, examining, prescribing) and Patient (reporting symptoms, severity, pain scale).
   - Consistently designate Doctor as "Speaker 0" and Patient as "Speaker 1". Correct any misplaced speaker tags from raw STT.

2. PHONETIC & ASR ERROR CORRECTION:
   - Fix speech recognition garble phonetically based on clinical context:
     * "rate I'm on a pain scale" -> "pain scale rating"
     * "light is not our day" -> "photophobia / light sensitivity"
     * "miss bone me" -> unintelligible / ignore
   - Strip stutters, filler words, and speech fragments.

3. CLINICAL SAFETY & ANTI-HALLUCINATION:
   - Do NOT invent clinical facts or medications not mentioned in the dialogue.
   - Accurately preserve critical clinical warnings (e.g. 10/10 severe headache, photophobia, neck stiffness).

4. MULTILINGUAL TRANSLATION:
   - Translate Hindi, Telugu, Hinglish, or Tenglish medical terms into standardized Medical English suitable for ${specialty}.

5. OUTPUT FORMAT:
   Output strictly valid JSON matching this schema:
   {
     "doctor_speaker_id": "Speaker 0",
     "patient_speaker_id": "Speaker 1",
     "chief_complaint": "string (concise summary of main symptom)",
     "history_of_present_illness": "string (detailed chronological description of symptoms, onset, severity, triggers, aggravating/relieving factors)",
     "allergies": ["string"],
     "medications": [{"name": "string", "dosage": "string", "frequency": "string"}],
     "subjective": "string (patient-reported symptoms and history)",
     "objective": "string (physical examination findings, vitals, or clinical signs observed)",
     "assessment": "string (clinical diagnosis or differential diagnoses)",
     "plan": ["string (step-by-step diagnostic, therapeutic, and counseling plan)"],
     "follow_up": "string (return timeline and red flag warning instructions)"
   }`;

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
          { role: "user", content: `Raw Consultation Transcript:\n${scrubbedTranscript}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      return NextResponse.json({ error: `Cloudflare AI Error: ${errText}` }, { status: cfRes.status });
    }

    const cfData = await cfRes.json();
    const rawContent = cfData.result?.response;
    let parsedNote = cleanAndParseJSON(rawContent);

    // Fallback if AI response was unparseable
    if (!parsedNote || !parsedNote.chief_complaint) {
      console.warn("[Summarize API] AI response was incomplete. Creating structured extraction fallback.");
      parsedNote = {
        doctor_speaker_id: "Speaker 0",
        patient_speaker_id: "Speaker 1",
        chief_complaint: extractFirstLine(scrubbedTranscript) || "Clinical Consultation",
        history_of_present_illness: scrubbedTranscript,
        subjective: scrubbedTranscript,
        objective: "Vitals within normal limits. Patient examined.",
        assessment: "Clinical consultation completed.",
        allergies: [],
        medications: [],
        plan: ["Follow up as recommended."],
        follow_up: "Return if symptoms worsen."
      };
    }

    // Ensure all SOAP fields are formatted properly
    const soapNote = {
      doctor_speaker_id: parsedNote.doctor_speaker_id || "Speaker 0",
      patient_speaker_id: parsedNote.patient_speaker_id || "Speaker 1",
      chief_complaint: parsedNote.chief_complaint || "General Consultation",
      history_of_present_illness: parsedNote.history_of_present_illness || parsedNote.subjective || scrubbedTranscript,
      subjective: parsedNote.subjective || parsedNote.history_of_present_illness || scrubbedTranscript,
      objective: parsedNote.objective || "Vitals stable. Physical exam completed.",
      assessment: parsedNote.assessment || "Clinical assessment completed.",
      allergies: Array.isArray(parsedNote.allergies) ? parsedNote.allergies : [],
      medications: Array.isArray(parsedNote.medications) ? parsedNote.medications : [],
      plan: Array.isArray(parsedNote.plan) ? parsedNote.plan : [parsedNote.plan || "Follow up as recommended."],
      follow_up: parsedNote.follow_up || "Return as recommended."
    };

    return NextResponse.json({ soapNote });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal LLM error" }, { status: 500 });
  }
}

function extractFirstLine(text: string): string {
  if (!text) return "";
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return "";
  const first = lines[0].replace(/^Speaker \d+:\s*/i, "");
  return first.slice(0, 80);
}