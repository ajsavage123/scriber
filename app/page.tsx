"use client";
import React, { useState } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptViewer from "@/components/TranscriptViewer";
import NoteEditor from "@/components/NoteEditor";
import { Consultation, SOAPNote } from "@/lib/types";

export default function Dashboard() {
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSaveNote = async (finalNote: SOAPNote) => {
    if (!activeConsultation) return;

    const res = await fetch(`/api/consultations/${activeConsultation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        final_approved_soap_note: finalNote,
        status: "SIGNED",
        clinician_signed_at: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      // Use a more professional toast/notification instead of alert
      // For now, we'll keep alert but in a real app this would be a toast
      alert("Consultation signed and saved successfully!");
      setActiveConsultation({ ...activeConsultation, status: "SIGNED", final_approved_soap_note: finalNote });
    }
  };

  const handleEraseNote = async () => {
    if (!activeConsultation) return;
    if (confirm("Are you sure you want to permanently delete this medical record? This action cannot be undone.")) {
      const res = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Record permanently erased.");
        setActiveConsultation(null);
      }
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col space-y-8">
          {/* Header */}
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Ambient Medical Scribe
              </h1>
              <p className="text-muted-foreground text-sm">
                Professional AI-Powered Clinical Documentation
              </p>
            </div>
            
            {activeConsultation && (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-medium">🏥</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">Patient ID</p>
                    <p className="text-muted-foreground">{activeConsultation.patient_synthetic_id}</p>
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* Audio Recording Section */}
          <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    Start Clinical Consultation
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Record, transcribe, and generate SOAP notes with AI assistance
                  </p>
                </div>
                
                <AudioRecorder 
                  onSuccess={(cons) => setActiveConsultation(cons)}
                  className="w-full lg:w-auto"
                />
              </div>
            </div>
          </section>

          {/* Review Section */}
          {activeConsultation && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transcript Viewer */}
              <article className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    Diarized Audio Transcript
                  </h2>
                  <div className="flex items-center gap-2 text-sm">
                    {(activeConsultation.diarized_transcript?.utterances?.length ?? 0) > 0 && (
                      <>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <span className="w-2 h-2 rounded bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-medium">🎙️</span>
                          </span>
                          Speakers: {new Set((activeConsultation.diarized_transcript?.utterances ?? []).map(u => u.speaker)).size}
                        </span>
                        <span className="mx-2 h-4 border border-border/50 hidden lg:block"></span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <span className="w-2 h-2 rounded bg-muted/20 flex items-center justify-center">
                            <span className="text-muted-foreground font-medium">⏱️</span>
                          </span>
                          Duration: {
                            Math.max(...(activeConsultation.diarized_transcript?.utterances ?? []).map(u => u.end)).toFixed(1)
                          }s
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <TranscriptViewer
                  utterances={activeConsultation.diarized_transcript?.utterances || []}
                  doctorSpeakerId={activeConsultation.raw_ai_soap_note?.doctor_speaker_id}
                  patientSpeakerId={activeConsultation.raw_ai_soap_note?.patient_speaker_id}
                />
                
                {/* Transcript actions */}
                {(activeConsultation.diarized_transcript?.utterances?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <button
                      onClick={() => {
                        // Copy transcript to clipboard
                        const transcript = (activeConsultation.diarized_transcript?.utterances ?? [])
                          .map(u => `Speaker ${u.speaker}: ${u.text}`)
                          .join("\n");
                        navigator.clipboard.writeText(transcript);
                        alert("Transcript copied to clipboard");
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/50 transition-colors rounded-lg"
                    >
                      <span className="w-4 h-4">📋</span>
                      Copy Transcript
                    </button>
                  </div>
                )}
              </article>

              {/* Note Editor */}
              <article className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    Clinical SOAP Note
                  </h2>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
                    <span className="w-3 h-3 rounded flex items-center justify-center">
                      {activeConsultation.status === "SIGNED" ? (
                        <span className="text-success font-medium">✓</span>
                      ) : (
                        <span className="text-warning font-medium">📝</span>
                      )}
                    </span>
                    <span className="whitespace-nowrap">
                      {activeConsultation.status === "SIGNED" ? "Signed & Approved" : "AI Draft - Review Required"}
                    </span>
                  </div>
                </div>
                
                <NoteEditor
                  initialNote={activeConsultation.final_approved_soap_note || activeConsultation.raw_ai_soap_note!}
                  onSave={handleSaveNote}
                  onErase={handleEraseNote}
                  isFinalized={activeConsultation.status === "SIGNED"}
                />
                
              </article>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}