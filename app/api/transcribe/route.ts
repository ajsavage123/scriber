import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as Blob;
    const language = (formData.get("language") as string) || "multi";

    if (!file) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Deepgram Nova-3 Medical Acoustic Configuration:
    // Keyterm boosting for common medical vocabulary, filler word suppression, and speaker diarization
    const keyterms = [
      "Tylenol:5", "Motrin:5", "headache:5", "pain:5", "severity:5",
      "scale:5", "stiffness:5", "neck:5", "light:5", "photophobia:5",
      "fever:5", "symptoms:5", "duration:5", "mg:5", "dosage:5"
    ].join("&keyterm=");

    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&utt_split=0.6&punctuate=true&smart_format=true&filler_words=false&language=${encodeURIComponent(language)}&keyterm=${keyterms}`;

    const response = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": file.type || "audio/webm",
      },
      body: buffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Deepgram Error: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    let utterances = data.results?.utterances?.map((u: any) => ({
      speaker: u.speaker,
      raw_speaker_id: `Speaker ${u.speaker}`,
      text: u.transcript,
      start: u.start,
      end: u.end,
      start_ms: Math.round(u.start * 1000),
      end_ms: Math.round(u.end * 1000)
    })) || [];

    // Inspect granular word-level diarization to recover speaker switches missed by coarse utterance chunking
    const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    if (words.length > 0) {
      const distinctWordSpeakers = new Set(words.map((w: any) => w.speaker).filter((s: any) => typeof s === "number"));
      const distinctUtteranceSpeakers = new Set(utterances.map((u: any) => u.speaker));
      
      // If words array detected multiple distinct speakers while utterances only had 1, reconstruct from word boundaries
      if (distinctWordSpeakers.size > distinctUtteranceSpeakers.size) {
        const reconstructedUtterances: any[] = [];
        let currentSpeaker: number | null = null;
        let currentWords: string[] = [];
        let currentStart = 0;
        let currentEnd = 0;

        for (const w of words) {
          const spk = typeof w.speaker === "number" ? w.speaker : 0;
          const wordText = w.punctuated_word || w.word || "";
          if (currentSpeaker === null) {
            currentSpeaker = spk;
            currentStart = w.start || 0;
            currentEnd = w.end || 0;
            currentWords = [wordText];
          } else if (currentSpeaker === spk) {
            currentWords.push(wordText);
            currentEnd = w.end || currentEnd;
          } else {
            reconstructedUtterances.push({
              speaker: currentSpeaker,
              raw_speaker_id: `Speaker ${currentSpeaker}`,
              text: currentWords.join(" "),
              start: currentStart,
              end: currentEnd,
              start_ms: Math.round(currentStart * 1000),
              end_ms: Math.round(currentEnd * 1000)
            });
            currentSpeaker = spk;
            currentStart = w.start || 0;
            currentEnd = w.end || 0;
            currentWords = [wordText];
          }
        }
        if (currentWords.length > 0 && currentSpeaker !== null) {
          reconstructedUtterances.push({
            speaker: currentSpeaker,
            raw_speaker_id: `Speaker ${currentSpeaker}`,
            text: currentWords.join(" "),
            start: currentStart,
            end: currentEnd,
            start_ms: Math.round(currentStart * 1000),
            end_ms: Math.round(currentEnd * 1000)
          });
        }
        if (reconstructedUtterances.length > 0) {
          utterances = reconstructedUtterances;
        }
      }
    }

    let formattedTranscript = utterances.length > 0
      ? utterances.map((u: any) => `Speaker ${u.speaker}: ${u.text}`).join("\n")
      : data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    // Fallback for short recordings where Deepgram didn't split diarized utterances
    if (utterances.length === 0 && formattedTranscript) {
      utterances = [{
        speaker: 0,
        raw_speaker_id: "Speaker 0",
        text: formattedTranscript,
        start: 0,
        end: 5,
        start_ms: 0,
        end_ms: 5000
      }];
      formattedTranscript = `Speaker 0: ${formattedTranscript}`;
    }

    // If no speech was detected by STT in Live Mode, return a clear error instead of fabricating mock dialogue.
    if (!formattedTranscript) {
      return NextResponse.json({ error: "No voice or speech detected in the recording. Please check your microphone, speak clearly, and try again." }, { status: 400 });
    }

    return NextResponse.json({ formattedTranscript, utterances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal STT error" }, { status: 500 });
  }
}