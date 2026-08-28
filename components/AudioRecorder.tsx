"use client";
import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Sparkles, ChevronDown, CheckCircle2, AlertTriangle, Zap, FileText, Database, Pause, Play, Shield, ToggleLeft, ToggleRight, Sliders, Settings2 } from "lucide-react";
import ConsentModal from "./ConsentModal";
import { generateSyntheticPatientId } from "@/lib/piiScrubber";
import { useToast } from "./Toast";
import SpeakerAmbientVisualizer, { ActiveSpeaker } from "./SpeakerAmbientVisualizer";
import { DemoScenario, DEMO_SCENARIOS, getSimulatedAudioState } from "@/lib/demoAudioSimulator";

interface AudioRecorderProps {
  onSuccess: (consultation: any) => void;
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

export default function AudioRecorder({ onSuccess, className, onAudioStateChange }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLang, setConsentLang] = useState<string | null>(null);
  const [language, setLanguage] = useState("multi");
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showDevControls, setShowDevControls] = useState(false);
  
  // Zero-Token Demo Sandbox & Scenario Selection (Hydration-safe)
  const [mounted, setMounted] = useState(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setDemoMode(localStorage.getItem("demo_sandbox_mode") === "true");
    }
  }, []);

  const [demoScenario, setDemoScenario] = useState<DemoScenario>("full_test");

  const { addToast } = useToast();

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

  const currentActiveSpeaker: ActiveSpeaker = demoMode
    ? (isPaused ? "none" : simulatedState.activeSpeaker)
    : (!recording || isPaused || audioLevel < 0.02 ? "none" : (audioLevel > 0.45 ? "both" : (duration % 8 < 4 ? "clinician" : "patient")));

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
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setIsPaused(false);
    addToast("info", "Recording stopped", `Captured ${formatTime(duration)} of audio. Processing now...`);
  };

  const visualizeAudio = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i] / 128 - 1;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / bufferLength);
      setAudioLevel(Math.min(rms * 4, 1)); 
    };
    
    draw();
  };

  const processPipeline = async (audioBlob: Blob) => {
    try {
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
        setPipelineStep("transcribing");
        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("language", language);

        const sttRes = await fetch("/api/transcribe", { method: "POST", body: formData });
        sttData = await sttRes.json();
        if (!sttRes.ok) {
          throw new Error(sttData.error || "Speech-to-text failed. Deepgram could not process the audio.");
        }
        addToast("success", "Transcription complete", `Detected ${sttData.utterances?.length || 0} speaker turns.`);

        setPipelineStep("generating");
        const llmRes = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            transcript: sttData.formattedTranscript,
            specialty: savedSpecialty 
          }),
        });
        llmData = await llmRes.json();
        if (!llmRes.ok) {
          throw new Error(llmData.error || "SOAP note generation failed. The AI could not process the transcript.");
        }
        addToast("success", "SOAP note generated", "AI has structured the clinical notes.");
      }

      setPipelineStep("saving");
      const syntheticId = generateSyntheticPatientId();
      const saveRes = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_synthetic_id: syntheticId,
          specialty: savedSpecialty,
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

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save the consultation record.");
      }

      setPipelineStep("done");
      addToast("success", "Consultation ready!", `Patient ${syntheticId} — review the SOAP note below.`);
      
      setTimeout(() => {
        setPipelineStep("idle");
        onSuccess(saveData.consultation);
      }, 1000);
      
    } catch (err: any) {
      console.error(err);
      setPipelineError(err.message);
      setPipelineStep("error");
      addToast("error", "Pipeline failed", err.message);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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

      <div className={`glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-200/90 ${className || ""}`}>
        {/* Studio Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  Ambient Scribe Studio
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {recording ? (isPaused ? "⏸️ Recording Paused" : "🔴 Live Clinical Listening...") : "Ready for patient encounter."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mounted && demoMode && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-mono font-bold shadow-xs">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>DEMO</span>
                </div>
              )}

              {/* Discrete Developer Controls Toggle Icon */}
              <button
                onClick={() => setShowDevControls(!showDevControls)}
                className={`p-2.5 rounded-2xl transition-all cursor-pointer border ${
                  showDevControls 
                    ? "bg-slate-200/90 text-slate-900 border-slate-300 shadow-inner" 
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 border-slate-200/70 shadow-xs"
                }`}
                title="Developer & Testing Controls"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Collapsible Developer & Testing Drawer (Collapsed by default) */}
          {showDevControls && (
            <div className="p-4.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3 animate-fade-in-up shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>Developer & Testing Controls</span>
                </div>

                <button
                  onClick={toggleDemoMode}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                    demoMode 
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-400" 
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <span>{demoMode ? "⚡ Demo Sandbox (0 Tokens)" : "🌐 Live API Mode"}</span>
                  {demoMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
              </div>

              {mounted && demoMode && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Audio Simulation Scenarios</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DEMO_SCENARIOS.map((sc) => (
                      <button
                        key={sc.key}
                        onClick={() => setDemoScenario(sc.key)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          demoScenario === sc.key 
                            ? "bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs" 
                            : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-medium"
                        }`}
                      >
                        <p className="font-bold">{sc.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Central Hero Mobile Interaction: Speaker Visualizer + Main Recording Controls */}
          <div className="space-y-5">
            {/* Unified Speaker Ambient Visualizer Hero Section */}
            <div className="rounded-2xl overflow-hidden shadow-md shadow-slate-900/5 border border-slate-200/90">
              <SpeakerAmbientVisualizer
                activeSpeaker={currentActiveSpeaker}
                audioLevel={currentAudioLevel}
                isRecording={recording}
                isPaused={isPaused}
              />
            </div>

            {/* Central Touch Interaction Bar (Language Selector + Primary Recording Controls) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              {/* Spoken Language Dropdown */}
              <div className="w-full sm:w-64">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Spoken Language</label>
                <div className="relative">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={recording || isProcessing}
                    className="w-full appearance-none rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  >
                    <option value="multi">🌐 Auto-Detect (Code-Mixed)</option>
                    <option value="en">English (en)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Main Action Control Buttons */}
              <div className="w-full sm:w-auto flex items-center justify-end">
                {!recording ? (
                  <button
                    onClick={handleStartClick}
                    disabled={isProcessing}
                    className="w-full sm:w-64 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm uppercase tracking-wider btn-3d-emerald transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2.5 group"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Mic className="w-4 h-4 text-white" />
                        </div>
                        <span>Start Recording</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Active Timer Pill */}
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 text-red-600 rounded-2xl text-xs font-bold font-mono border border-red-200/80 shadow-xs">
                      <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"}`}></span>
                      {formatTime(duration)}
                    </div>

                    {/* Pause / Resume Button */}
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-sm cursor-pointer border ${
                        isPaused 
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/20" 
                          : "bg-amber-500 hover:bg-amber-600 text-white border-amber-400 shadow-amber-500/20"
                      }`}
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {isPaused ? "Resume" : "Pause"}
                    </button>

                    {/* Stop & Generate Button */}
                    <button
                      onClick={stopRecording}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-red-500/20 border border-red-500 transition-all duration-300 cursor-pointer"
                    >
                      <Square className="w-4 h-4" /> Stop & Generate
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        {isProcessing && (
          <div className="border-t border-gray-100 bg-gray-50/60 px-8 py-6 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Processing Pipeline</span>
            </div>
            <div className="flex items-center gap-0">
              {PIPELINE_STEPS.map((step, idx) => {
                const isActive = step.key === pipelineStep;
                const isComplete = currentStepIndex > idx;
                const StepIcon = step.icon;
                
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isComplete ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                        : isActive ? "bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500 ring-offset-2" 
                        : "bg-gray-100 text-gray-400"
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-5 h-5" /> 
                        : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> 
                        : <StepIcon className="w-5 h-5" />}
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-bold ${isActive ? "text-emerald-700" : isComplete ? "text-emerald-600" : "text-gray-400"}`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-[10px] text-gray-500 mt-0.5 max-w-[140px] leading-tight">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all duration-500 ${
                        isComplete || (currentStepIndex > idx) ? "bg-emerald-500" : "bg-gray-200"
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Error State */}
        {pipelineStep === "error" && pipelineError && (
          <div className="border-t border-red-100 bg-red-50/60 px-8 py-5 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Something went wrong</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">{pipelineError}</p>
              </div>
              <button
                onClick={handleStartClick}
                className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}