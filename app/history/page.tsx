"use client";
import React, { useEffect, useState } from "react";
import { Consultation } from "@/lib/types";
import { History, Search, Trash2, Calendar, FileText, CheckCircle2, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import TranscriptViewer from "@/components/TranscriptViewer";
import NoteEditor from "@/components/NoteEditor";
import SpeakerAmbientVisualizer, { ActiveSpeaker } from "@/components/SpeakerAmbientVisualizer";

export default function HistoryPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [reviewSpeaker, setReviewSpeaker] = useState<ActiveSpeaker>("none");
  const { addToast } = useToast();

  const [isRetryingSoap, setIsRetryingSoap] = useState(false);
  const [isRemappingSoap, setIsRemappingSoap] = useState(false);
  const [hasSpeakerCorrection, setHasSpeakerCorrection] = useState(false);

  const handleUpdateSpeakerRoles = async (
    speakerRoles: Record<string, { role: string; confidence: number }>,
    doctorSpeakerId: string,
    patientSpeakerId: string
  ) => {
    if (!selectedConsultation) return;

    setHasSpeakerCorrection(true);

    const currentNote = selectedConsultation.final_approved_soap_note || selectedConsultation.raw_ai_soap_note || {
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

    // Optimistically update selectedConsultation
    const updatedCons = {
      ...selectedConsultation,
      raw_ai_soap_note: updatedNote,
      final_approved_soap_note: updatedNote
    };
    setSelectedConsultation(updatedCons);
    setConsultations(prev => prev.map(c => c.id === updatedCons.id ? updatedCons : c));

    try {
      const res = await fetch(`/api/consultations/${selectedConsultation.id}`, {
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
    if (!selectedConsultation) return;

    setIsRemappingSoap(true);
    try {
      const res = await fetch(`/api/consultations/${selectedConsultation.id}/remap-roles`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remap speaker roles.");
      }

      setSelectedConsultation(data.consultation);
      setConsultations(prev => prev.map(c => c.id === data.consultation.id ? data.consultation : c));
      addToast("success", "Roles remapped", "AI successfully analyzed speaker roles (1 AI call used).");
    } catch (err: any) {
      console.error(err);
      addToast("error", "Remap Failed", err.message);
    } finally {
      setIsRemappingSoap(false);
    }
  };

  const handleRegenerateSoap = async () => {
    if (!selectedConsultation) return;
    const transcriptText = selectedConsultation.diarized_transcript?.formattedTranscript;
    if (!transcriptText) {
      addToast("error", "Missing Transcript", "No transcript text available for SOAP generation.");
      return;
    }

    setIsRetryingSoap(true);
    try {
      const savedSpecialty = (typeof window !== "undefined" && localStorage.getItem("medical_specialty")) || selectedConsultation.specialty || "General Practice";
      const currentNote = selectedConsultation.final_approved_soap_note || selectedConsultation.raw_ai_soap_note;

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
      const patchRes = await fetch(`/api/consultations/${selectedConsultation.id}`, {
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
      const finalCons = updated.consultation || updated;
      setSelectedConsultation(finalCons);
      setConsultations(prev => prev.map(c => c.id === finalCons.id ? finalCons : c));
      setHasSpeakerCorrection(false); // Reset correction trigger after successful regeneration
      addToast("success", "SOAP Note Regenerated", "Clinical SOAP note regenerated respecting corrected speaker roles (1 AI call used).");
    } catch (err: any) {
      console.error(err);
      addToast("error", "Regeneration Failed", err.message);
    } finally {
      setIsRetryingSoap(false);
    }
  };

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/consultations");
      const data = await res.json();
      if (res.ok) {
        setConsultations(data.consultations || []);
      } else {
        addToast("error", "Error loading history", data.error || "Could not fetch past consultations.");
      }
    } catch (err: any) {
      addToast("error", "Network error", "Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const handleErase = async (id: string) => {
    try {
      const res = await fetch(`/api/consultations/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("warning", "Record Erased", "Consultation permanently deleted under DPDP Act 2023.");
        setConsultations(prev => prev.filter(c => c.id !== id));
        if (selectedConsultation?.id === id) setSelectedConsultation(null);
      } else {
        const data = await res.json();
        addToast("error", "Deletion failed", data.error);
      }
    } catch (err) {
      addToast("error", "Error", "Could not delete consultation.");
    }
  };

  const handleSaveNote = async (finalNote: any) => {
    if (!selectedConsultation) return;
    try {
      const res = await fetch(`/api/consultations/${selectedConsultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_approved_soap_note: finalNote,
          status: "SIGNED",
          clinician_signed_at: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        addToast("success", "Consultation saved!", "Updated SOAP note in Supabase.");
        const updated = { ...selectedConsultation, status: "SIGNED" as const, final_approved_soap_note: finalNote };
        setSelectedConsultation(updated);
        setConsultations(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    } catch (err) {
      addToast("error", "Error", "Could not update consultation.");
    }
  };

  const filtered = consultations.filter(c => 
    c.patient_synthetic_id?.toLowerCase().includes(search.toLowerCase()) ||
    c.selected_language?.toLowerCase().includes(search.toLowerCase()) ||
    c.status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8 animate-fade-in-up">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6 mt-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <History className="w-8 h-8 text-emerald-600" />
              Consultation Records
            </h1>
            <p className="text-gray-500 text-sm">
              Review, edit, or purge historical clinical AI documentation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient ID or language..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 text-xs font-medium bg-white border border-slate-200/90 rounded-full outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all w-64 shadow-xs"
              />
            </div>
            <Link
              href="/"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              + New Consultation
            </Link>
          </div>
        </div>

        {/* If reviewing a selected consultation */}
        {selectedConsultation ? (
          <div className="space-y-6 animate-fade-in-up">
            <button
              onClick={() => setSelectedConsultation(null)}
              className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full transition-colors w-fit border border-emerald-200/60 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to History List
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Transcript */}
              <article className="glass-card rounded-[32px] p-6 lg:p-8 flex flex-col h-[750px] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100/60">
                  <h2 className="text-xl font-display font-bold text-gray-900">
                    Diarized Transcript — {selectedConsultation.patient_synthetic_id}
                  </h2>
                  <span className="text-xs font-semibold text-gray-500 uppercase px-3 py-1 bg-slate-100 rounded-full">
                    🌐 {selectedConsultation.selected_language}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TranscriptViewer
                    utterances={selectedConsultation.diarized_transcript?.utterances || []}
                    doctorSpeakerId={selectedConsultation.final_approved_soap_note?.doctor_speaker_id || selectedConsultation.raw_ai_soap_note?.doctor_speaker_id}
                    patientSpeakerId={selectedConsultation.final_approved_soap_note?.patient_speaker_id || selectedConsultation.raw_ai_soap_note?.patient_speaker_id}
                    speakerRoles={selectedConsultation.final_approved_soap_note?.speaker_roles || selectedConsultation.raw_ai_soap_note?.speaker_roles || {}}
                    onUpdateSpeakerRoles={handleUpdateSpeakerRoles}
                  />
                </div>
              </article>

              {/* SOAP Note */}
              <article className="glass-card rounded-[32px] p-6 lg:p-8 flex flex-col h-[750px]">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100/60">
                  <h2 className="text-xl font-display font-bold text-gray-900">
                    Clinical Note Review
                  </h2>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                    {selectedConsultation.status === "SIGNED" ? "✓ Signed EHR" : "Pending Signature"}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <NoteEditor
                    key={selectedConsultation.id}
                    initialNote={selectedConsultation.final_approved_soap_note || selectedConsultation.raw_ai_soap_note!}
                    onSave={handleSaveNote}
                    onErase={() => handleErase(selectedConsultation.id)}
                    onRetrySoap={handleRegenerateSoap}
                    onRemapRoles={handleRemapRoles}
                    onRegenerateSoap={handleRegenerateSoap}
                    isPendingSoap={selectedConsultation.status === "TRANSCRIBED" || !selectedConsultation.raw_ai_soap_note}
                    isRetrying={isRetryingSoap}
                    isRemapping={isRemappingSoap}
                    isFinalized={selectedConsultation.status === "SIGNED"}
                    hasSpeakerCorrection={hasSpeakerCorrection}
                  />
                </div>
              </article>
            </div>
          </div>
        ) : (
          /* Consultations List View */
          <div>
            {loading ? (
              <div className="py-16 text-center text-gray-400 font-medium animate-pulse">
                Loading saved consultation records from Supabase...
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-card rounded-[32px] p-12 text-center space-y-4">
                <FileText className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="text-lg font-bold text-gray-800">No Consultations Found</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  {search ? "No records match your search filter." : "You haven't completed any consultations yet. Start recording from the dashboard."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="glass-card rounded-3xl p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-300 group border border-slate-200/80"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-2xs">
                          {c.patient_synthetic_id}
                        </span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          c.status === "SIGNED" ? "bg-emerald-100 text-emerald-800 border border-emerald-200/60" : "bg-amber-100 text-amber-800 border border-amber-200/60"
                        }`}>
                          {c.status === "SIGNED" ? "✓ Signed" : "Draft"}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-900 line-clamp-1">
                          {c.final_approved_soap_note?.chief_complaint || c.raw_ai_soap_note?.chief_complaint || "General Practice Visit"}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {c.final_approved_soap_note?.assessment || c.raw_ai_soap_note?.assessment || "Clinical assessment completed via AI scribe."}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                        <span className="uppercase font-semibold">
                          🌐 {c.selected_language}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-5 mt-4 border-t border-gray-100/60">
                      <button
                        onClick={() => setSelectedConsultation(c)}
                        className="flex-1 py-2.5 px-4 bg-gray-900 hover:bg-emerald-600 text-white font-bold text-xs rounded-full transition-all duration-300 text-center cursor-pointer shadow-sm"
                      >
                        Review & Edit Note
                      </button>
                      <button
                        onClick={() => handleErase(c.id)}
                        className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full transition-colors cursor-pointer"
                        title="Purge under DPDP Act"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
