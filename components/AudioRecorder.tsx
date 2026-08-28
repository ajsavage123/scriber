"use client";
import React, { useState, useRef } from "react";
import { Mic, Square, Loader2, Sparkles, Volume2, Volume1, VolumeX, Activity } from "lucide-react";
import ConsentModal from "./ConsentModal";
import { generateSyntheticPatientId } from "@/lib/piiScrubber";

interface AudioRecorderProps {
  onSuccess: (consultation: any) => void;
  className?: string;
}

export default function AudioRecorder({ onSuccess, className }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLang, setConsentLang] = useState<string | null>(null);
  const [language, setLanguage] = useState("multi");
  const [audioLevel, setAudioLevel] = useState(0);
   
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const handleStartClick = () => {
    if (!consentLang) {
      setShowConsentModal(true);
    } else {
      startRecording();
    }
  };

  const handleConsentGiven = (lang: string) => {
    setConsentLang(lang);
    setShowConsentModal(false);
    startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, noiseSuppression: true, echoCancellation: true },
      });

      // Set up audio visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        // Clean up audio visualization
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
          analyserRef.current = null;
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processPipeline(audioBlob);
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      
      // Start audio visualization
      visualizeAudio();
    } catch (err) {
      console.error(err);
      alert("Microphone access denied or unsupported browser.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const visualizeAudio = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) for volume level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i] / 128 - 1;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / bufferLength);
      setAudioLevel(Math.min(rms * 2 + 0.2, 1)); // Scale and clamp
    };
    
    draw();
  };

  const processPipeline = async (audioBlob: Blob) => {
    setLoading(true);
    try {
      // 1. Send Audio to Deepgram Nova-3 API
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("language", language);

      const sttRes = await fetch("/api/transcribe", { method: "POST", body: formData });
      const sttData = await sttRes.json();

      if (!sttRes.ok) throw new Error(sttData.error || "STT failed");

      // 2. Send Transcript to Cloudflare Llama-3.3 for SOAP formatting
      const llmRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: sttData.formattedTranscript }),
      });
      const llmData = await llmRes.json();

      if (!llmRes.ok) throw new Error(llmData.error || "SOAP generation failed");

      // 3. Save draft to Supabase
      const syntheticId = generateSyntheticPatientId();
      const saveRes = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_synthetic_id: syntheticId,
          selected_language: language,
          consent_obtained: true,
          consent_language: consentLang,
          consent_timestamp: new Date().toISOString(),
          diarized_transcript: sttData,
          raw_ai_soap_note: llmData.soapNote,
          final_approved_soap_note: llmData.soapNote,
          status: "GENERATED",
        }),
      });

      const { consultation } = await saveRes.json();
      onSuccess(consultation);
    } catch (err: any) {
      console.error(err);
      alert(`Error processing consultation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showConsentModal && (
        <ConsentModal
          onConsent={handleConsentGiven}
          onCancel={() => setShowConsentModal(false)}
        />
      )}

      <div className={`bg-card rounded-2xl border border-border p-6 shadow-lg ${className || ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary/foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-semibold text-foreground">
                  Ambient Consultation Studio
                </h3>
                <p className="text-muted-foreground text-sm">
                  Professional AI-Powered Clinical Documentation
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={recording || loading}
              className="flex-h-none whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              <option value="multi">🌐 Auto-Detect / Code-Mixed (Hinglish/Tenglish)</option>
              <option value="en">English (en)</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          {!recording ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border border-border/50 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mic className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-full opacity-0 ring-2 ring-primary animate-pulse" />
                </div>
              </div>
              
              <p className="text-center text-muted-foreground max-w-xl">
                Click to start recording your clinical consultation. The system will automatically transcribe, 
                diarize speakers, and generate a structured SOAP note using AI.
              </p>
              
              <button
                onClick={handleStartClick}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 
                    <span>Processing Clinical Audio with AI...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> 
                    <span>Start Consultation Recording</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 rounded-full border border-destructive/50 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-destructive/30 flex items-center justify-center text-[2px]">
                          <Square className="w-4 h-4 text-destructive" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Audio level visualization */}
                  <div className="absolute inset-0 pointer-none">
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[3px] bg-destructive" 
                         style={{ height: `${audioLevel * 100}%` }}></div>
                  </div>
                </div>
              </div>
              
              <p className="text-center text-muted-foreground">
                Recording in progress... Speak clearly into your microphone.
              </p>
              
              <div className="flex items-center justify-center space-x-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-medium">🎙️</span>
                  </div>
                  <span>Live Audio Feed</span>
                </div>
                
                <div className="w-px h-6 bg-border/50 hidden lg:block"></div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-muted/20 flex items-center justify-center">
                    <span className="text-muted-foreground font-medium">⏱️</span>
                  </div>
                  <span id="recording-timer">00:00</span>
                </div>
              </div>
              
              <button
                onClick={stopRecording}
                className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 transition-colors shadow-sm"
              >
                <Square className="w-4 h-4" /> 
                <span>Stop & Generate SOAP Note</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}