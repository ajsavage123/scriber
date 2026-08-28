import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const systemPrompt = `You are a clinical AI scribe. Analyze the following diarized consultation transcript.
 Speakers are tagged as "Speaker 0", "Speaker 1", etc.
 1. Determine which speaker is Doctor vs Patient based on clinical questioning vs symptom reporting.
 2. The transcript may be in Hindi, Telugu, English, Hinglish, or Tenglish. Translate all regional symptoms into standardized Medical English.
 3. Extract accurate clinical facts without hallucinating unmentioned conditions or medications.
 4. Output strictly valid JSON matching this schema:
 {
   "doctor_speaker_id": "Speaker 0 or 1",
   "patient_speaker_id": "Speaker 0 or 1",
   "chief_complaint": "string",
   "history_of_present_illness": "string",
   "allergies": ["string"],
   "medications": [{"name": "string", "dosage": "string", "frequency": "string"}],
   "subjective": "string",
   "objective": "string",
   "assessment": "string",
   "plan": ["string"],
   "follow_up": "string"
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
          { role: "user", content: `Transcript:\n${transcript}` },
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
    const soapNote = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;

    return NextResponse.json({ soapNote });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal LLM error" }, { status: 500 });
  }
}