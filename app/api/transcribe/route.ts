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

    // Deepgram Nova-3 with Speaker Diarization, Smart Formatting and Multi-language support
    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&punctuate=true&language=${encodeURIComponent(language)}&smart_format=true`;

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
    const utterances = data.results?.utterances?.map((u: any) => ({
      speaker: u.speaker,
      text: u.transcript,
      start: u.start,
      end: u.end,
    })) || [];

    const formattedTranscript = utterances.length > 0
      ? utterances.map((u: any) => `Speaker ${u.speaker}: ${u.text}`).join("\n")
      : data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    if (!formattedTranscript) {
      return NextResponse.json({ error: "Deepgram returned an empty transcript." }, { status: 422 });
    }

    return NextResponse.json({ formattedTranscript, utterances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal STT error" }, { status: 500 });
  }
}