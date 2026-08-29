import { NextRequest, NextResponse } from "next/server";
import { scrubTextPII } from "@/lib/piiScrubber";
import { cleanAndParseJSON, validateAndSanitizeSOAP } from "@/lib/soapSanitizer";


export async function POST(req: NextRequest) {
  let estimatedInputTokens = 0;
  let transcriptChars = 0;
  const startTime = Date.now();

  try {
    const { transcript, specialty = "General Practice", corrected_speaker_roles } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Valid consultation transcript is required" }, { status: 400 });
    }

    const scrubbedTranscript = scrubTextPII(transcript);
    transcriptChars = scrubbedTranscript.length;
    // Approximation: 1 token ≈ 4 characters
    estimatedInputTokens = Math.ceil(transcriptChars / 4) + 450; // +450 for system prompt

    if (transcriptChars > 60000) {
      console.warn(`[Summarize API Alert] Long consultation transcript received (${transcriptChars} chars, ~${estimatedInputTokens} tokens). Preserving full content without silent truncation.`);
    }

    const systemPrompt = `You are a Senior Clinical AI Documentation Specialist specializing in ${specialty}.
Your task is to analyze the provided raw speech-to-text transcript of a medical encounter and extract a standardized, professional clinical SOAP note.

CLINICAL RULES:
1. Output language: English only (standard medical terminology).
2. Translation: All output fields must be in professional clinical English. If the raw transcript is multilingual (Hindi, Telugu, Hinglish, or mixed-language), translate the clinical details accurately to English before populating the fields.
3. Factuality: Extract ONLY documented clinical facts.
4. Missing Information: If vitals, physical exams, allergies, medications, or specific plan items were NOT discussed in the conversation, explicitly state "Not documented" or provide an empty list []. NEVER fabricate vitals, diagnoses, or prescriptions.
5. Speaker Attribution & Diarization:
   - Identify the role of each distinct raw speaker ID when sufficient evidence exists (roles: doctor, patient, caregiver, interpreter, other, unknown).
   - If the raw STT transcript lumped all conversational turns under a single speaker (e.g. all "Speaker 0:"), but the dialogue contains distinct doctor-patient exchanges (questions and answers, symptom descriptions, instructions), you MUST separate and re-attribute each turn into distinct speaker turns in the 'diarized_transcript' field using "Speaker 0" for Doctor and "Speaker 1" for Patient.
   - If the raw STT transcript already has distinct speaker IDs, preserve those speaker IDs in 'diarized_transcript'.
   - Do not force a speaker into doctor or patient when the conversation does not provide enough evidence. If the role cannot be determined reliably, use 'unknown'.
   - The confidence value is only a model-reported confidence/review signal. It is NOT a statistically validated probability.
6. Assessment: Document only the clinician's explicitly stated assessment, diagnosis, or differential diagnosis. If the clinician did not explicitly document an assessment or diagnosis, return 'Not documented'. Do not independently diagnose or infer a diagnosis.

7. MEDICATIONS / PRESCRIPTIONS RULE:
The \`medications\` array MUST contain ONLY medications that the clinician explicitly prescribed, newly started, dose-adjusted, or explicitly continued during this encounter.
Do NOT put patient-reported home medications, self-medication, previously taken medications, or medications taken before the encounter into the \`medications\` array.
If the patient says they took Paracetamol, Dolo 650, Tylenol, or another medication before/during arrival, record that information in \`subjective\` or \`history_of_present_illness\` as patient-reported medication history.
Only place a medication in \`medications\` when the clinician explicitly authorizes/prescribes/continues it during this encounter.
If no clinician-authorized medication exists, return: \`"medications": []\`

OUTPUT CONSTRAINT:
You must return a single JSON object where the keys are EXACTLY:
- doctor_speaker_id
- patient_speaker_id
- speaker_roles
- diarized_transcript
- chief_complaint
- history_of_present_illness
- allergies
- medications
- subjective
- objective
- assessment
- plan
- follow_up

The 'speaker_roles' key must map to an object where each key is a raw speaker ID (e.g. "Speaker 0", "Speaker 1") and the value is an object containing:
{
  "role": "doctor | patient | caregiver | interpreter | other | unknown",
  "confidence": number between 0 and 1
}

The 'diarized_transcript' key must be a string containing the line-by-line speaker turns (e.g. "Speaker 0: ...\\nSpeaker 1: ...").

Do NOT add any other keys, schema references ($schema), comments, preambles, remarks, or conversational text inside or outside the JSON keys.`;

    const userContent = `Clinical Consultation Transcript:\n${scrubbedTranscript}`;

    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;

    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    };

    // Resilient invocation with 1 automatic retry on transient errors
    let response: Response | null = null;
    let lastError: string | null = null;
    let attempt = 0;
    const maxAttempts = 2;
    const startTime = Date.now();

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout for long consultations

        response = await fetch(cfUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          break; // Success
        }

        const errStatus = response.status;
        const errText = await response.text();
        lastError = errText;

        // Check for non-retryable quota errors
        const isQuotaExceeded = errStatus === 429 && (
          errText.toLowerCase().includes("daily") ||
          errText.toLowerCase().includes("quota") ||
          errText.toLowerCase().includes("limit")
        );

        if (isQuotaExceeded) {
          const executionMs = Date.now() - startTime;
          console.warn(`[Summarize API] Daily Cloudflare AI Neuron limit exceeded. Status: 429, Duration: ${executionMs}ms`);
          return NextResponse.json(
            {
              error: "Daily AI note generation quota reached. Your transcript has been safely preserved. You can retry later or review the diarized transcript.",
              errorCode: "DAILY_QUOTA_EXCEEDED",
              rawTranscriptSaved: true,
            },
            { status: 429 }
          );
        }

        // For 5xx or transient 429, attempt 1 retry after delay
        if (attempt < maxAttempts && (errStatus >= 500 || errStatus === 429)) {
          console.warn(`[Summarize API] Transient error (HTTP ${errStatus}) on attempt ${attempt}. Retrying in 1500ms...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        break;
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          lastError = "Request timed out after 35 seconds.";
        } else {
          lastError = fetchErr.message || "Network connection error.";
        }

        if (attempt < maxAttempts) {
          console.warn(`[Summarize API] Network/Timeout error on attempt ${attempt}: ${lastError}. Retrying in 1500ms...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        break;
      }
    }

    const executionMs = Date.now() - startTime;

    if (!response || !response.ok) {
      console.error(`[Summarize API Error] Inference failed after ${attempt} attempt(s). Status: ${response?.status || 'ERR'}, Latency: ${executionMs}ms, Details: ${lastError}`);
      
      const isTimeout = lastError?.toLowerCase().includes("timeout");
      const userMessage = isTimeout
        ? "AI note generation timed out. Your transcript is safely preserved. Please click Retry SOAP Note."
        : "AI note generation is temporarily unavailable. Your transcript is safely preserved. Please click Retry SOAP Note.";

      return NextResponse.json(
        {
          error: userMessage,
          errorCode: isTimeout ? "TIMEOUT" : "TRANSIENT_FAILURE",
          rawTranscriptSaved: true,
        },
        { status: response?.status === 429 ? 429 : 503 }
      );
    }

    const cfData = await response.json();
    const rawContent = cfData.result?.response;
    const parsedRaw = cleanAndParseJSON(rawContent);
    const validatedSoap = validateAndSanitizeSOAP(parsedRaw, scrubbedTranscript, corrected_speaker_roles);

    if (!validatedSoap) {
      console.error(`[Summarize API] Unparseable JSON from model. Raw response preview: ${String(rawContent).slice(0, 200)}...`);
      return NextResponse.json(
        {
          error: "AI produced an unparseable response. Your transcript is preserved. Please click Retry SOAP Note.",
          errorCode: "INVALID_AI_RESPONSE",
          rawTranscriptSaved: true,
        },
        { status: 502 }
      );
    }

    // Privacy-safe metrics log (NO patient data, NO transcripts, NO secrets)
    console.log(`[Summarize API Metrics] ${JSON.stringify({
      timestamp: new Date().toISOString(),
      transcriptChars,
      estimatedInputTokens,
      executionMs,
      attempts: attempt,
      status: "SUCCESS"
    })}`);

    return NextResponse.json({
      soapNote: validatedSoap,
    });

  } catch (error: any) {
    const executionMs = Date.now() - startTime;
    console.error(`[Summarize API Fatal] Unexpected exception: ${error.message}, Latency: ${executionMs}ms`);
    return NextResponse.json(
      {
        error: "An unexpected error occurred during SOAP generation. Your transcript is safe. Please click Retry SOAP Note.",
        errorCode: "INTERNAL_ERROR",
        rawTranscriptSaved: true,
      },
      { status: 500 }
    );
  }
}