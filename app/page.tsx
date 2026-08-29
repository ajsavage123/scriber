"use client";
import React, { useState, useEffect, useCallback } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptViewer from "@/components/TranscriptViewer";
import NoteEditor from "@/components/NoteEditor";
import { ActiveSpeaker } from "@/components/SpeakerAmbientVisualizer";
import { Consultation, SOAPNote } from "@/lib/types";
import { LayoutDashboard, CheckCircle2, FileText, MessageSquare, Columns, Globe, ChevronDown } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function Dashboard() {
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [activeReviewTab, setActiveReviewTab] = useState<"soap" | "transcript" | "split">("soap");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("multi");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("preferred_language");
      if (savedLang) setSelectedLanguage(savedLang);
    }
  }, []);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_language", lang);
    }
  };

  const { addToast } = useToast();
  const [isRetryingSoap, setIsRetryingSoap] = useState(false);
  const [isRemappingSoap, setIsRemappingSoap] = useState(false);
  const [hasSpeakerCorrection, setHasSpeakerCorrection] = useState(false);

  const handleSuccess = useCallback((cons: Consultation) => {
    setActiveConsultation(cons);
    setActiveReviewTab(cons.status === "TRANSCRIBED" ? "transcript" : "soap");
    setHasSpeakerCorrection(false);
    
    // Smoothly roll out and scroll to the generated SOAP Note & Transcript
    setTimeout(() => {
      const noteSection = document.getElementById("notes-section");
      if (noteSection) {
        noteSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  }, []);

  const handleUpdateSpeakerRoles = async (
    speakerRoles: Record<string, { role: string; confidence: number }>,
    doctorSpeakerId: string,
    patientSpeakerId: string
  ) => {
    if (!activeConsultation) return;

    setHasSpeakerCorrection(true);

    const currentNote = activeConsultation.final_approved_soap_note || activeConsultation.raw_ai_soap_note || {
      chief_complaint: "",
      history_of_present_illness: "",
      allergies: [],
      medications: [],
      subjective: "",
      objective: "",
      assessment: "",
      plan: [],
      follow_up: "",
    };

    const updatedNote = {
      ...currentNote,
      doctor_speaker_id: doctorSpeakerId,
      patient_speaker_id: patientSpeakerId,
      speaker_roles: speakerRoles,
      needs_review: Object.values(speakerRoles).some(r => r.role === "unknown") || Object.keys(speakerRoles).length > 2
    };

    // Optimistically update UI
    setActiveConsultation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        raw_ai_soap_note: updatedNote,
        final_approved_soap_note: updatedNote
      };
    });

    try {
      const res = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_ai_soap_note: updatedNote,
          final_approved_soap_note: updatedNote
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save speaker role correction to database.");
      }
      addToast("success", "Roles corrected", "Speaker mapping updated locally (zero AI calls used).");
    } catch (err: any) {
      addToast("error", "Error", err.message);
    }
  };

  const handleRemapRoles = async () => {
    if (!activeConsultation) return;

    setIsRemappingSoap(true);
    try {
      const res = await fetch(`/api/consultations/${activeConsultation.id}/remap-roles`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remap speaker roles.");
      }

      setActiveConsultation(data.consultation);
      addToast("success", "Roles remapped", "AI successfully analyzed speaker roles (1 AI call used).");
    } catch (err: any) {
      console.error(err);
      addToast("error", "Remap Failed", err.message);
    } finally {
      setIsRemappingSoap(false);
    }
  };

  const handleRegenerateSoap = async () => {
    if (!activeConsultation) return;
    const transcriptText = activeConsultation.diarized_transcript?.formattedTranscript;
    if (!transcriptText) {
      addToast("error", "Missing Transcript", "No transcript text available for SOAP generation.");
      return;
    }

    setIsRetryingSoap(true);
    try {
      const savedSpecialty = (typeof window !== "undefined" && localStorage.getItem("medical_specialty")) || activeConsultation.specialty || "General Practice";
      const currentNote = activeConsultation.final_approved_soap_note || activeConsultation.raw_ai_soap_note;

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          specialty: savedSpecialty,
          corrected_speaker_roles: currentNote?.speaker_roles
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "SOAP note generation failed.");
      }

      // Update Supabase record with generated SOAP Note
      const patchRes = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_ai_soap_note: data.soapNote,
          final_approved_soap_note: data.soapNote,
          status: "GENERATED",
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Generated note could not be saved to database.");
      }

      const updated = await patchRes.json();
      setActiveConsultation(updated.consultation || updated);
      setHasSpeakerCorrection(false); // Reset correction trigger after successful regeneration
      addToast("success", "SOAP Note Regenerated", "Clinical SOAP note regenerated respecting corrected speaker roles (1 AI call used).");
    } catch (err: any) {
      console.error(err);
      addToast("error", "Regeneration Failed", err.message);
    } finally {
      setIsRetryingSoap(false);
    }
  };

  const handleRetrySoap = async () => {
    if (!activeConsultation) return;
    const transcriptText = activeConsultation.diarized_transcript?.formattedTranscript;
    if (!transcriptText) {
      addToast("error", "Missing Transcript", "No transcript text available for SOAP generation.");
      return;
    }

    setIsRetryingSoap(true);
    try {
      const savedSpecialty = (typeof window !== "undefined" && localStorage.getItem("medical_specialty")) || activeConsultation.specialty || "General Practice";
      
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          specialty: savedSpecialty,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "SOAP note generation failed.");
      }

      // Update Supabase record with generated SOAP Note
      const patchRes = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_ai_soap_note: data.soapNote,
          final_approved_soap_note: data.soapNote,
          status: "GENERATED",
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Generated note could not be saved to database.");
      }

      const updated = await patchRes.json();
      setActiveConsultation(updated.consultation || updated);
      setActiveReviewTab("soap");
      addToast("success", "SOAP Note Generated", "Clinical SOAP note is now ready for review.");
    } catch (err: any) {
      console.error(err);
      addToast("error", "SOAP Retry Failed", err.message);
    } finally {
      setIsRetryingSoap(false);
    }
  };

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
    <div className="w-full flex-1 flex flex-col px-1.5 sm:px-4 lg:px-6 max-w-[1900px] mx-auto min-h-0 h-full">
      <div className="flex-1 flex flex-col space-y-1 sm:space-y-2 min-h-0 h-full">
        {/* Header Bar */}
        {activeConsultation ? (
          <header className="flex items-center justify-between px-1 py-1 sm:py-1.5">
            <div className="hidden lg:block space-y-0.5">
              <h1 className="text-xl font-display font-bold text-gray-900 tracking-tight">
                Live Consultation
              </h1>
            </div>
            
            {/* Patient ID Badge (3D Pill) */}
            <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/95 border border-slate-200/90 shadow-sm shadow-slate-900/5 transition-all ml-auto">
              <div className="w-5 h-5 rounded-full bg-emerald-100/80 flex items-center justify-center border border-emerald-300/80 shadow-xs">
                <span className="text-emerald-800 font-bold text-[9px]">PT</span>
              </div>
              <div className="space-y-0">
                <p className="text-[7px] uppercase font-bold text-gray-400 tracking-wider leading-none">Patient ID</p>
                <p className="font-bold text-gray-900 text-[11px] font-mono">{activeConsultation.patient_synthetic_id}</p>
              </div>
              {activeConsultation.status === "SIGNED" && (
                <div className="ml-1 pl-1.5 border-l border-gray-200 flex items-center text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              )}
            </div>
          </header>
        ) : null}

        {/* Audio Recording Section (3D Curved Window) */}
        <section id="recorder-section" className="animate-fade-in-up flex-1 w-full flex flex-col min-h-0 h-full p-0 sm:p-0.5">
          <AudioRecorder 
            onSuccess={handleSuccess}
            language={selectedLanguage}
            className="flex-1 w-full h-full"
          />
        </section>

        {/* Review Section */}
        {activeConsultation && (
          <section id="notes-section" className="space-y-6 animate-fade-in-up pb-10" style={{ animationDelay: '200ms' }}>
            {/* View Switcher Segmented Control Bar (Soft Curved 3D Pill Layout) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-xl p-2.5 rounded-[28px] border border-slate-200/90 shadow-md shadow-slate-900/5">
              {/* Segmented Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100/90 p-1.5 rounded-full border border-slate-200/70 shadow-inner">
                <button
                  onClick={() => setActiveReviewTab("soap")}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === "soap"
                      ? "bg-white text-emerald-800 shadow-sm border border-slate-200/80 font-bold scale-[1.02]"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Clinical SOAP Note</span>
                </button>

                <button
                  onClick={() => setActiveReviewTab("transcript")}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === "transcript"
                      ? "bg-white text-indigo-800 shadow-sm border border-slate-200/80 font-bold scale-[1.02]"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Diarized Transcript</span>
                </button>

                <button
                  onClick={() => setActiveReviewTab("split")}
                  className={`hidden lg:flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeReviewTab === "split"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold scale-[1.02]"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Columns className="w-4 h-4 text-slate-600" />
                  <span>Split Dual View</span>
                </button>
              </div>
            </div>

            {/* Content Panes (3D Curved Tile Windows) */}
            <div className={`grid gap-8 ${activeReviewTab === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
              {/* Note Editor (Shown in 'soap' or 'split' tabs) */}
              {(activeReviewTab === "soap" || activeReviewTab === "split") && (
                <article className="tile-3d-card rounded-[32px] p-6 lg:p-8 flex flex-col h-[720px] shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
                    <div className="space-y-1">
                      <h2 className="text-xl font-display font-bold text-gray-900">
                        Clinical SOAP Note
                      </h2>
                      <p className="text-xs text-gray-500 font-medium">Standardized medical formatting</p>
                    </div>
                    
                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border shadow-xs ${
                      activeConsultation.status === "SIGNED" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : activeConsultation.status === "TRANSCRIBED"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}>
                      {activeConsultation.status === "SIGNED" ? "✓ Signed & Approved" : activeConsultation.status === "TRANSCRIBED" ? "⚠️ Transcript Only" : "✍️ AI Draft Review"}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <NoteEditor
                      key={activeConsultation.id}
                      initialNote={activeConsultation.final_approved_soap_note || activeConsultation.raw_ai_soap_note}
                      onSave={handleSaveNote}
                      onErase={handleEraseNote}
                      onRetrySoap={handleRetrySoap}
                      onRemapRoles={handleRemapRoles}
                      onRegenerateSoap={handleRegenerateSoap}
                      isPendingSoap={activeConsultation.status === "TRANSCRIBED" || !activeConsultation.raw_ai_soap_note}
                      isRetrying={isRetryingSoap}
                      isRemapping={isRemappingSoap}
                      isFinalized={activeConsultation.status === "SIGNED"}
                      hasSpeakerCorrection={hasSpeakerCorrection}
                    />
                  </div>
                </article>
              )}

              {/* Diarized Transcript Viewer (Shown in 'transcript' or 'split' tabs) */}
              {(activeReviewTab === "transcript" || activeReviewTab === "split") && (
                <article className="tile-3d-card rounded-[32px] p-6 lg:p-8 flex flex-col h-[720px] shadow-xl">
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
                      doctorSpeakerId={activeConsultation.final_approved_soap_note?.doctor_speaker_id || activeConsultation.raw_ai_soap_note?.doctor_speaker_id}
                      patientSpeakerId={activeConsultation.final_approved_soap_note?.patient_speaker_id || activeConsultation.raw_ai_soap_note?.patient_speaker_id}
                      speakerRoles={activeConsultation.final_approved_soap_note?.speaker_roles || activeConsultation.raw_ai_soap_note?.speaker_roles || {}}
                      onUpdateSpeakerRoles={handleUpdateSpeakerRoles}
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