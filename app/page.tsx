"use client";
import React, { useState, useCallback } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptViewer from "@/components/TranscriptViewer";
import NoteEditor from "@/components/NoteEditor";
import { ActiveSpeaker } from "@/components/SpeakerAmbientVisualizer";
import { Consultation, SOAPNote } from "@/lib/types";
import { LayoutDashboard, CheckCircle2, FileText, MessageSquare, Columns } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function Dashboard() {
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [activeReviewTab, setActiveReviewTab] = useState<"soap" | "transcript" | "split">("soap");
  const [liveAudioState, setLiveAudioState] = useState<{ activeSpeaker: ActiveSpeaker; audioLevel: number; isRecording: boolean; isPaused: boolean }>({
    activeSpeaker: "none",
    audioLevel: 0,
    isRecording: false,
    isPaused: false,
  });

  const { addToast } = useToast();

  const handleAudioStateChange = useCallback(
    (st: { activeSpeaker: ActiveSpeaker; audioLevel: number; isRecording: boolean; isPaused: boolean }) => {
      setLiveAudioState(prev => {
        if (
          prev.activeSpeaker === st.activeSpeaker &&
          prev.audioLevel === st.audioLevel &&
          prev.isRecording === st.isRecording &&
          prev.isPaused === st.isPaused
        ) {
          return prev;
        }
        return st;
      });
    },
    []
  );

  const handleSuccess = useCallback((cons: Consultation) => {
    setActiveConsultation(cons);
    setActiveReviewTab("soap"); // Default to SOAP Note view immediately on completion
  }, []);

  const handleSaveNote = async (finalNote: SOAPNote) => {
    if (!activeConsultation) return;

    try {
      const res = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_approved_soap_note: finalNote,
          status: "SIGNED",
        }),
      });

      if (!res.ok) throw new Error("Failed to save note");

      const updated = await res.json();
      setActiveConsultation(updated);
      addToast("success", "SOAP Note Signed & Finalized", "The approved note has been stored to EHR history.");
    } catch (err) {
      console.error(err);
      addToast("error", "Save Failed", "Could not update the consultation note.");
    }
  };

  const handleEraseNote = async () => {
    if (!activeConsultation) return;
    if (!window.confirm("Are you sure you want to erase this consultation note?")) return;

    try {
      const res = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setActiveConsultation(null);
      addToast("info", "Consultation Reset", "Note has been cleared. You can begin a new encounter.");
    } catch (err) {
      console.error(err);
      addToast("error", "Reset Failed", "Could not erase the consultation.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col space-y-8 animate-fade-in-up">
        {/* Patient Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mt-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">
              Live Consultation
            </h1>
            <p className="text-gray-500 text-sm">
              Real-time ambient clinical scribe & SOAP notes.
            </p>
          </div>
          
          {activeConsultation && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-md shadow-slate-900/5 transition-all mt-3 lg:mt-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200/80 shadow-xs">
                <span className="text-emerald-700 font-bold text-sm">PT</span>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Patient ID</p>
                <p className="font-bold text-gray-900 text-sm font-mono">{activeConsultation.patient_synthetic_id}</p>
              </div>
              {activeConsultation.status === "SIGNED" && (
                <div className="ml-2 pl-3 border-l border-gray-200 flex items-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>
          )}
        </header>

        {/* Audio Recording Section (High-Priority Hierarchy) */}
        <section className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <AudioRecorder 
            onSuccess={handleSuccess}
            onAudioStateChange={handleAudioStateChange}
          />
        </section>

        {/* Review Section */}
        {activeConsultation && (
          <section className="space-y-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            {/* View Switcher Segmented Control Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-900/5">
              {/* Segmented Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
                <button
                  onClick={() => setActiveReviewTab("soap")}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === "soap"
                      ? "bg-white text-emerald-800 shadow-sm border border-slate-200/80 font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Clinical SOAP Note</span>
                </button>

                <button
                  onClick={() => setActiveReviewTab("transcript")}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === "transcript"
                      ? "bg-white text-indigo-800 shadow-sm border border-slate-200/80 font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Diarized Transcript</span>
                </button>

                <button
                  onClick={() => setActiveReviewTab("split")}
                  className={`hidden lg:flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === "split"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Columns className="w-4 h-4 text-slate-600" />
                  <span>Split Dual View</span>
                </button>
              </div>
            </div>

            {/* Content Panes */}
            <div className={`grid gap-8 ${activeReviewTab === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
              {/* Note Editor (Shown in 'soap' or 'split' tabs) */}
              {(activeReviewTab === "soap" || activeReviewTab === "split") && (
                <article className="glass-card rounded-3xl p-6 lg:p-8 flex flex-col h-[720px] tile-3d-hover">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
                    <div className="space-y-1">
                      <h2 className="text-xl font-display font-bold text-gray-900">
                        Clinical SOAP Note
                      </h2>
                      <p className="text-xs text-gray-500 font-medium">Standardized medical formatting</p>
                    </div>
                    
                    <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${
                      activeConsultation.status === "SIGNED" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {activeConsultation.status === "SIGNED" ? "✓ Signed & Approved" : "✍️ AI Draft Review"}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <NoteEditor
                      key={activeConsultation.id}
                      initialNote={activeConsultation.final_approved_soap_note || activeConsultation.raw_ai_soap_note!}
                      onSave={handleSaveNote}
                      onErase={handleEraseNote}
                      isFinalized={activeConsultation.status === "SIGNED"}
                    />
                  </div>
                </article>
              )}

              {/* Diarized Transcript Viewer (Shown in 'transcript' or 'split' tabs) */}
              {(activeReviewTab === "transcript" || activeReviewTab === "split") && (
                <article className="glass-card rounded-3xl p-6 lg:p-8 flex flex-col h-[720px] space-y-4 tile-3d-hover">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                    <div className="space-y-1">
                      <h2 className="text-xl font-display font-bold text-gray-900">
                        Diarized Transcript
                      </h2>
                      <p className="text-xs text-gray-500 font-medium">Auto-detected speakers & timing</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      {(activeConsultation.diarized_transcript?.utterances?.length ?? 0) > 0 && (
                        <>
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            {new Set((activeConsultation.diarized_transcript?.utterances ?? []).map(u => u.speaker)).size} Speakers
                          </span>
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200/80 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            {Math.max(...(activeConsultation.diarized_transcript?.utterances ?? []).map(u => u.end)).toFixed(1)}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <TranscriptViewer
                      utterances={activeConsultation.diarized_transcript?.utterances || []}
                      doctorSpeakerId={activeConsultation.raw_ai_soap_note?.doctor_speaker_id}
                      patientSpeakerId={activeConsultation.raw_ai_soap_note?.patient_speaker_id}
                    />
                  </div>
                  
                  {/* Transcript actions */}
                  {(activeConsultation.diarized_transcript?.utterances?.length ?? 0) > 0 && (
                    <div className="pt-3 border-t border-slate-200/80 shrink-0">
                      <button
                        onClick={() => {
                          const transcript = (activeConsultation.diarized_transcript?.utterances ?? [])
                            .map(u => `Speaker ${u.speaker}: ${u.text}`)
                            .join("\n");
                          navigator.clipboard.writeText(transcript);
                          addToast("info", "Copied!", "Transcript copied to clipboard.");
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/80 transition-all rounded-xl border border-indigo-200/80 shadow-xs cursor-pointer"
                      >
                        Copy Transcript
                      </button>
                    </div>
                  )}
                </article>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}