"use client";
import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Sparkles, ChevronDown, CheckCircle2, AlertTriangle, Zap, FileText, Database, Pause, Play, Shield, ToggleLeft, ToggleRight, Sliders, Settings2, Trash2, Download, RefreshCw, X, Check } from "lucide-react";
import ConsentModal from "./ConsentModal";
import { generateSyntheticPatientId } from "@/lib/piiScrubber";
import { useToast } from "./Toast";
import SpeakerAmbientVisualizer, { ActiveSpeaker } from "./SpeakerAmbientVisualizer";
import { DemoScenario, DEMO_SCENARIOS, getSimulatedAudioState } from "@/lib/demoAudioSimulator";

interface AudioRecorderProps {
  onSuccess: (consultation: any) => void;
  language?: string;
  className?: string;
  onAudioStateChange?: (state: { activeSpeaker: ActiveSpeaker; audioLevel: number; isRecording: boolean; isPaused: boolean }) => void;
}

type PipelineStep = "idle" | "transcribing" | "generating" | "saving" | "done" | "error";

const PIPELINE_STEPS = [
  { key: "transcribing", label: "Transcribing Audio", icon: Mic, description: "Processing audio diarization..." },
  { key: "generating", label: "Generating SOAP Note", icon: FileText, description: "Structuring clinical notes..." },
  { key: "saving", label: "Saving Record", icon: Database, description: "Storing consultation record..." },
  { key: "done", label: "Complete", icon: CheckCircle2, description: "Consultation record is ready for review." },
];

export default function AudioRecorder({ onSuccess, language = "multi", className, onAudioStateChange }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [failedAudioBlob, setFailedAudioBlob] = useState<Blob | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLang, setConsentLang] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [pitch, setPitch] = useState(0.4);
  const [frequencies, setFrequencies] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [showDevControls, setShowDevControls] = useState(false);
  
  // Zero-Token Demo Sandbox & Scenario Selection (Hydration-safe)
  const [mounted, setMounted] = useState(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("full_test");

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setDemoMode(localStorage.getItem("demo_sandbox_mode") === "true");
      const savedScenario = localStorage.getItem("demo_scenario");
      if (savedScenario) setDemoScenario(savedScenario as DemoScenario);
    }
  }, []);

  const { addToast } = useToast();

  const [liveSpeaker, setLiveSpeaker] = useState<"clinician" | "patient">("clinician");
  const silenceCounterRef = useRef(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const isProcessing = pipelineStep !== "idle" && pipelineStep !== "error";

  const toggleDemoMode = () => {
    const next = !demoMode;
    setDemoMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("demo_sandbox_mode", String(next));
    }
    if (next) {
      addToast("info", "⚡ Demo Sandbox Enabled", "0 API tokens consumed. Real-time audio & speaker simulation active.");
    } else {
      addToast("info", "🌐 Live API Mode Enabled", "Real Deepgram Nova-3 & Cloudflare Llama 3.3 API calls active.");
    }
  };

  // Derive audio state (Hardware mic in Live mode vs Simulated in Demo Sandbox)
  const simulatedState = getSimulatedAudioState(demoScenario, duration);

  const currentAudioLevel = demoMode 
    ? (isPaused ? 0 : simulatedState.audioLevel) 
    : audioLevel;

  const currentPitch = demoMode
    ? (isPaused ? 0.3 : simulatedState.pitch)
    : pitch;

  const currentFrequencies = demoMode
    ? (isPaused ? [] : simulatedState.frequencies)
    : frequencies;

  const currentActiveSpeaker: ActiveSpeaker = demoMode
    ? (isPaused ? "none" : simulatedState.activeSpeaker)
    : (!recording || isPaused || audioLevel < 0.025 ? "none" : (audioLevel > 0.45 ? "both" : liveSpeaker));

  const onAudioStateChangeRef = useRef(onAudioStateChange);
  useEffect(() => {
    onAudioStateChangeRef.current = onAudioStateChange;
  }, [onAudioStateChange]);

  // Notify parent component of live audio state for global visualizer
  useEffect(() => {
    if (onAudioStateChangeRef.current) {
      onAudioStateChangeRef.current({
        activeSpeaker: currentActiveSpeaker,
        audioLevel: currentAudioLevel,
        isRecording: recording,
        isPaused: isPaused,
      });
    }
  }, [currentActiveSpeaker, currentAudioLevel, recording, isPaused]);

  const handleStartClick = () => {
    setPipelineError(null);
    setPipelineStep("idle");
    
    if (!consentLang) {
      setShowConsentModal(true);
    } else {
      startRecording();
    }
  };

  const handleConsentGiven = (lang: string) => {
    setConsentLang(lang);
    setShowConsentModal(false);
    addToast("success", "Consent recorded", "Patient consent has been captured and timestamped.");
    startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, noiseSuppression: true, echoCancellation: true },
      });

      audioContextRef.current = new window.AudioContext();
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
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
          analyserRef.current = null;
        }

        stream.getTracks().forEach(t => t.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processPipeline(audioBlob);
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setIsPaused(false);
      setDuration(0);
      setPipelineError(null);
      setPipelineStep("idle");
      setLiveSpeaker("clinician");
      silenceCounterRef.current = 0;
      
      addToast("info", demoMode ? "⚡ Demo Sandbox Started" : "Recording started", "0 tokens spent in Demo mode.");

      timerIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      visualizeAudio();
    } catch (err: any) {
      console.error(err);
      setPipelineError("Microphone access was denied. Please allow microphone permissions in your browser.");
      setPipelineStep("error");
      addToast("error", "Microphone access denied", "Please allow microphone permissions and try again.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      addToast("warning", "Recording paused", "Audio capture is paused. Click resume to continue.");
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      addToast("info", "Recording resumed", "Audio capture has resumed.");
    }
  };

  const stopRecording = () => {
    if (isProcessing) return;
    setPipelineStep("transcribing"); // Set step synchronously to disable all user controls immediately
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setIsPaused(false);
    addToast("info", "Recording stopped", `Captured ${formatTime(duration)} of audio. Processing now...`);
  };

  const discardRecording = () => {
    if (isProcessing) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    if (mediaRecorderRef.current) {
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      mediaRecorderRef.current.onstop = null; // Clear handler to avoid processing
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    audioChunksRef.current = [];
    setRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioLevel(0);
    setLiveSpeaker("clinician");
    silenceCounterRef.current = 0;
    
    // Notify parent component of reset state
    if (onAudioStateChangeRef.current) {
      onAudioStateChangeRef.current({
        activeSpeaker: "none",
        audioLevel: 0,
        isRecording: false,
        isPaused: false,
      });
    }

    addToast("warning", "Recording discarded", "The audio recording has been cancelled and deleted.");
  };

  const lastUiUpdateRef = useRef(0);

  const visualizeAudio = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const timeArray = new Uint8Array(bufferLength);
    const freqArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(timeArray);
      analyser.getByteFrequencyData(freqArray);
      
      // 1. RMS Audio Level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = timeArray[i] / 128 - 1;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const level = Math.min(rms * 4, 1);

      // 2. Real-Time Vocal Pitch / Spectral Centroid calculation
      let weightedSum = 0;
      let totalFreqSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const mag = freqArray[i];
        weightedSum += i * mag;
        totalFreqSum += mag;
      }
      const centroid = totalFreqSum > 0 ? weightedSum / totalFreqSum : 0;
      const computedPitch = Math.max(0.1, Math.min(1.0, (centroid - 3) / 36));

      // Intelligent speaker turn switching based on silence detection
      if (level < 0.06) {
        silenceCounterRef.current += 1;
      } else {
        if (silenceCounterRef.current > 45) {
          setLiveSpeaker(prev => (prev === "clinician" ? "patient" : "clinician"));
        }
        silenceCounterRef.current = 0;
      }

      // Throttle React state reconciliation to ~25fps (every 40ms)
      // This prevents mobile CPU throttling while keeping the canvas animation butter-smooth
      const now = performance.now();
      if (now - lastUiUpdateRef.current >= 40) {
        lastUiUpdateRef.current = now;
        setAudioLevel(level);
        setPitch(computedPitch);

        // 8-Band Frequency Spectrum
        const bands: number[] = [];
        const bandSize = Math.max(1, Math.floor(bufferLength / 8));
        for (let b = 0; b < 8; b++) {
          let bSum = 0;
          for (let i = b * bandSize; i < (b + 1) * bandSize && i < bufferLength; i++) {
            bSum += freqArray[i];
          }
          bands.push(bSum / (bandSize * 255));
        }
        setFrequencies(bands);
      }
    };
    
    draw();
  };

  const processPipeline = async (audioBlob: Blob) => {
    try {
      const syntheticId = generateSyntheticPatientId();
      const savedSpecialty = (typeof window !== "undefined" && localStorage.getItem("medical_specialty")) || "General Practice";

      let sttData: any;
      let llmData: any;

      if (demoMode) {
        setPipelineStep("transcribing");
        await new Promise(r => setTimeout(r, 450));
        addToast("success", "⚡ Demo STT Complete", "0 API tokens consumed.");

        sttData = {
          formattedTranscript: "Speaker 0: Good morning! What brings you into the clinic today?\nSpeaker 1: Hello Doctor, I've had a severe headache for 3 days and fever.\nSpeaker 0: On a scale of 1 to 10, how severe would you rate the pain?\nSpeaker 1: It is around 7 or 8 out of 10, and bright light really bothers my eyes.",
          utterances: [
            { speaker: 0, text: "Good morning! What brings you into the clinic today?", start: 0.5, end: 3.2 },
            { speaker: 1, text: "Hello Doctor, I've had a severe headache for 3 days and fever.", start: 3.6, end: 7.8 },
            { speaker: 0, text: "On a scale of 1 to 10, how severe would you rate the pain?", start: 8.1, end: 11.2 },
            { speaker: 1, text: "It is around 7 or 8 out of 10, and bright light really bothers my eyes.", start: 11.5, end: 15.0 }
          ]
        };

        setPipelineStep("generating");
        await new Promise(r => setTimeout(r, 550));
        addToast("success", "⚡ Demo AI SOAP Complete", "0 Cloudflare AI tokens consumed.");

        llmData = {
          soapNote: {
            doctor_speaker_id: "Speaker 0",
            patient_speaker_id: "Speaker 1",
            chief_complaint: `Severe Headache & Mild Fever (${savedSpecialty})`,
            history_of_present_illness: "Patient presents with a 3-day history of severe diffuse headache rated 7-8/10 on pain scale, accompanied by photophobia and low-grade pyrexia.",
            subjective: "Patient reports severe headache lasting 3 days with light sensitivity (photophobia) and mild fever.",
            objective: "BP: 122/80 mmHg, Temp: 99.1°F, HR: 76 bpm. Cranial nerves II-XII intact. No nuchal rigidity.",
            assessment: `1. Acute Tension/Migraine Headache (${savedSpecialty} Context)\n2. Mild Low-Grade Pyrexia`,
            allergies: ["No Known Drug Allergies (NKDA)"],
            medications: [
              { name: "Paracetamol", dosage: "650mg", frequency: "TID PRN" }
            ],
            plan: [
              "Rest in a dark, quiet room and maintain adequate hydration",
              "Paracetamol 650mg PO for pain/fever as needed",
              "Monitor for red-flag neurological symptoms"
            ],
            follow_up: "Return to clinic in 3-5 days or immediately if neck stiffness or confusion develops."
          }
        };
      } else {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("language", language);

        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        sttData = await transcribeRes.json();
        if (!transcribeRes.ok) {
          throw new Error(sttData.error || "Audio transcription failed.");
        }

        setPipelineStep("generating");
        try {
          const summarizeRes = await fetch("/api/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: sttData.formattedTranscript,
              specialty: savedSpecialty,
            }),
          });

          llmData = await summarizeRes.json();
          if (!summarizeRes.ok) {
            console.warn("[Pipeline Notice] SOAP generation failed. Transcript preserved.", llmData.error);
          }
        } catch (sumErr: any) {
          console.warn("[Pipeline Notice] SOAP summarize exception:", sumErr.message);
        }
      }

      setPipelineStep("saving");

      let finalTranscript = sttData;
      if (llmData && llmData.soapNote && typeof llmData.soapNote.diarized_transcript === "string" && llmData.soapNote.diarized_transcript.trim().length > 0) {
        const reDiarizedLines = llmData.soapNote.diarized_transcript.trim().split("\n");
        const resolvedUtterances: any[] = [];
        
        reDiarizedLines.forEach((line: string, idx: number) => {
          const match = line.match(/^Speaker\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
          if (match) {
            const spkNum = parseInt(match[1], 10);
            const text = match[2].trim();
            const orig = sttData.utterances && sttData.utterances[idx];
            resolvedUtterances.push({
              speaker: isNaN(spkNum) ? 0 : spkNum,
              text: text,
              start: orig?.start ?? (idx * 3),
              end: orig?.end ?? ((idx + 1) * 3),
              start_ms: orig?.start_ms ?? (idx * 3000),
              end_ms: orig?.end_ms ?? ((idx + 1) * 3000)
            });
          }
        });
        
        finalTranscript = {
          formattedTranscript: llmData.soapNote.diarized_transcript,
          utterances: resolvedUtterances
        };
      }

      const isSoapGenerated = Boolean(llmData && llmData.soapNote);
      const consultationStatus = isSoapGenerated ? "GENERATED" : "TRANSCRIBED";

      const saveRes = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_synthetic_id: syntheticId,
          specialty: savedSpecialty,
          selected_language: language,
          consent_obtained: true,
          consent_timestamp: new Date().toISOString(),
          diarized_transcript: finalTranscript,
          raw_ai_soap_note: isSoapGenerated ? llmData.soapNote : undefined,
          final_approved_soap_note: isSoapGenerated ? llmData.soapNote : undefined,
          status: consultationStatus,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save record.");

      setPipelineStep("done");
      setTimeout(() => {
        setPipelineStep("idle");
        onSuccess(saveData.consultation);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setFailedAudioBlob(audioBlob);
      setPipelineError(err.message);
      setPipelineStep("error");
      addToast("error", "Pipeline Failed", err.message);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h.toString().padStart(2, '0')}:${m}:${s}`;
  };

  const currentStepIndex = PIPELINE_STEPS.findIndex(s => s.key === pipelineStep);

  return (
    <>
      {showConsentModal && (
        <ConsentModal
          onConsent={handleConsentGiven}
          onCancel={() => setShowConsentModal(false)}
        />
      )}

      <div className={`relative w-full h-full flex flex-col justify-between ${className || ""}`}>
        {/* Floating 1-Tap Mode Switcher Pill */}
        <div className="absolute top-2.5 sm:top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 rounded-full bg-slate-950/85 backdrop-blur-xl border border-slate-700/80 shadow-[0_4px_18px_rgba(0,0,0,0.5)] select-none">
          <button
            type="button"
            onClick={() => {
              if (demoMode) toggleDemoMode();
            }}
            disabled={recording}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
              !demoMode
                ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🌐 Live API
          </button>
          <button
            type="button"
            onClick={() => {
              if (!demoMode) toggleDemoMode();
            }}
            disabled={recording}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
              demoMode
                ? "bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)] font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⚡ Demo (0 Tokens)
          </button>
        </div>

        {recording && !isPaused && (
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-3xl blur-xl pointer-events-none -z-10 animate-pulse"></div>
        )}

        <SpeakerAmbientVisualizer
          activeSpeaker={currentActiveSpeaker}
          audioLevel={currentAudioLevel}
          pitch={currentPitch}
          frequencies={currentFrequencies}
          isRecording={recording}
          isPaused={isPaused}
          className="flex-1 w-full h-full min-h-0"
        >
          {!recording ? (
            <button
              onClick={handleStartClick}
              disabled={isProcessing}
              className="group p-3 flex items-center justify-center text-white hover:text-white/80 transition-transform duration-200 active:scale-90 cursor-pointer disabled:opacity-50"
              title="Start Recording"
            >
              {isProcessing ? (
                <Loader2 className="w-8 h-8 sm:w-9 sm:h-9 animate-spin text-white" />
              ) : (
                <Mic className="w-8 h-8 sm:w-9 sm:h-9 text-white group-hover:scale-110 transition-transform duration-200" />
              )}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full animate-fade-in-up">
              {/* Digital Timer matching reference */}
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-white drop-shadow-md select-none">
                {formatTime(duration)}
              </div>

              {/* 3-Button Control Dock matching reference picture */}
              <div className="flex items-center justify-center gap-5 sm:gap-8">
                {/* 1. Discard (✕) */}
                <button
                  onClick={discardRecording}
                  disabled={isProcessing}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-red-400 border border-slate-700/80 hover:border-red-500/50 shadow-lg flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer disabled:opacity-50 backdrop-blur-md"
                  title="Discard Recording"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                </button>

                {/* 2. Main Circle: Pause / Resume Button */}
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  disabled={isProcessing}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:shadow-[0_0_45px_rgba(37,99,235,0.85)] border-2 border-blue-400/40 flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50 select-none"
                  title={isPaused ? "Resume Recording" : "Pause Recording"}
                >
                  {isPaused ? <span>RESUME</span> : <span>PAUSE</span>}
                </button>

                {/* 3. OK / Save / Generate (✓) */}
                <button
                  onClick={stopRecording}
                  disabled={isProcessing}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/50 shadow-lg flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer disabled:opacity-50 backdrop-blur-md"
                  title="Finish & Generate SOAP"
                >
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )}
        </SpeakerAmbientVisualizer>

        {isProcessing && (
          <div className="border-t border-slate-800/80 bg-slate-950/90 p-4 sm:p-6 animate-fade-in-up backdrop-blur-xl">
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-inner">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white tracking-tight">
                      {pipelineStep === "transcribing" && "Transcribing Audio & Speakers..."}
                      {pipelineStep === "generating" && "Generating Clinical SOAP Note..."}
                      {pipelineStep === "done" && "Encounter Saved Successfully!"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {pipelineStep === "transcribing" && "Deepgram Nova-3 Multi-Speaker Diarization"}
                      {pipelineStep === "generating" && "Cloudflare Llama 3.3 Clinical Extraction"}
                      {pipelineStep === "done" && "Ready for review in Notes editor"}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  {pipelineStep === "transcribing" && "45%"}
                  {pipelineStep === "generating" && "85%"}
                  {pipelineStep === "done" && "100%"}
                </span>
              </div>

              {/* Traditional Clean Animated Gradient Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/60">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500 shadow-[0_0_10px_#06b6d4]"
                  style={{
                    width: pipelineStep === "transcribing" ? "45%" : pipelineStep === "generating" ? "85%" : "100%"
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error State with Audio Blob Rescue */}
        {pipelineStep === "error" && pipelineError && (
          <div className="border-t border-red-900/50 bg-red-950/30 px-6 sm:px-8 py-5 animate-fade-in-up backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/30">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-300">Processing Interrupted</p>
                  <p className="text-xs text-red-400/90 mt-0.5 leading-relaxed max-w-xl">{pipelineError}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {failedAudioBlob && (
                  <>
                    <button
                      onClick={() => {
                        const url = URL.createObjectURL(failedAudioBlob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `consultation_audio_rescue_${Date.now()}.webm`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        addToast("info", "Audio Downloaded", "Preserved audio file saved to your device.");
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all shadow-xs cursor-pointer"
                      title="Download recorded audio to prevent loss"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-300" />
                      Download Audio (.webm)
                    </button>

                    <button
                      onClick={() => processPipeline(failedAudioBlob)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Transcription
                    </button>
                  </>
                )}

                <button
                  onClick={handleStartClick}
                  className="px-3.5 py-2 text-xs font-bold text-red-300 bg-red-900/40 hover:bg-red-900/60 rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  New Recording
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}