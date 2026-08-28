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
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient ID or language..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all w-64"
              />
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
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
              className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to History List
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Transcript */}
              <article className="glass-card rounded-2xl p-6 lg:p-8 flex flex-col h-[750px] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100/60">
                  <h2 className="text-xl font-display font-bold text-gray-900">
                    Diarized Transcript — {selectedConsultation.patient_synthetic_id}
                  </h2>
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    🌐 {selectedConsultation.selected_language}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TranscriptViewer
                    utterances={selectedConsultation.diarized_transcript?.utterances || []}
                    doctorSpeakerId={selectedConsultation.raw_ai_soap_note?.doctor_speaker_id}
                    patientSpeakerId={selectedConsultation.raw_ai_soap_note?.patient_speaker_id}
                  />
                </div>
              </article>

              {/* SOAP Note */}
              <article className="glass-card rounded-2xl p-6 lg:p-8 flex flex-col h-[750px]">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100/60">
                  <h2 className="text-xl font-display font-bold text-gray-900">
                    Clinical Note Review
                  </h2>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                    selectedConsultation.status === "SIGNED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {selectedConsultation.status === "SIGNED" ? "✓ Signed" : "Draft"}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <NoteEditor
                    key={selectedConsultation.id}
                    initialNote={selectedConsultation.final_approved_soap_note || selectedConsultation.raw_ai_soap_note!}
                    onSave={handleSaveNote}
                    onErase={() => handleErase(selectedConsultation.id)}
                    isFinalized={selectedConsultation.status === "SIGNED"}
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
              <div className="glass-card rounded-3xl p-12 text-center space-y-4">
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
                    className="glass-card rounded-2xl p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-300 group border border-white/60"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100">
                          {c.patient_synthetic_id}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          c.status === "SIGNED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
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
                        className="flex-1 py-2 px-3 bg-gray-900 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all duration-300 text-center cursor-pointer"
                      >
                        Review & Edit Note
                      </button>
                      <button
                        onClick={() => handleErase(c.id)}
                        className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
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
