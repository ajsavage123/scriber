"use client";
import React, { useState } from "react";
import { SOAPNote } from "@/lib/types";
import { CheckCircle2, Trash2, Plus, GripVertical, Download, AlertTriangle, Stethoscope, ClipboardList, RefreshCw, Sparkles, Loader2 } from "lucide-react";

interface NoteEditorProps {
  initialNote?: SOAPNote;
  onSave: (finalNote: SOAPNote) => Promise<void>;
  onErase: () => Promise<void>;
  onRetrySoap?: () => Promise<void>;
  onRemapRoles?: () => Promise<void>;
  onRegenerateSoap?: () => Promise<void>;
  isPendingSoap?: boolean;
  isRetrying?: boolean;
  isRemapping?: boolean;
  isFinalized?: boolean;
  hasSpeakerCorrection?: boolean;
}

export default function NoteEditor({
  initialNote,
  onSave,
  onErase,
  onRetrySoap,
  onRemapRoles,
  onRegenerateSoap,
  isPendingSoap = false,
  isRetrying = false,
  isRemapping = false,
  isFinalized = false,
  hasSpeakerCorrection = false
}: NoteEditorProps) {
  const [note, setNote] = useState<SOAPNote>({
    chief_complaint: initialNote?.chief_complaint || "",
    history_of_present_illness: initialNote?.history_of_present_illness || "",
    subjective: initialNote?.subjective || initialNote?.history_of_present_illness || "",
    objective: initialNote?.objective || "",
    assessment: initialNote?.assessment || "",
    allergies: initialNote?.allergies || [],
    medications: initialNote?.medications || [],
    plan: initialNote?.plan || [],
    follow_up: initialNote?.follow_up || "",
    doctor_speaker_id: initialNote?.doctor_speaker_id || "Speaker 0",
    patient_speaker_id: initialNote?.patient_speaker_id || "Speaker 1",
    needs_review: initialNote?.needs_review || false,
    speaker_roles: initialNote?.speaker_roles || {},
  });
  const [saving, setSaving] = useState(false);
  const [erasing, setErasing] = useState(false);

  React.useEffect(() => {
    if (initialNote) {
      setNote({
        chief_complaint: initialNote.chief_complaint || "",
        history_of_present_illness: initialNote.history_of_present_illness || "",
        subjective: initialNote.subjective || initialNote.history_of_present_illness || "",
        objective: initialNote.objective || "",
        assessment: initialNote.assessment || "",
        allergies: initialNote.allergies || [],
        medications: initialNote.medications || [],
        plan: initialNote.plan || [],
        follow_up: initialNote.follow_up || "",
        doctor_speaker_id: initialNote.doctor_speaker_id || "Speaker 0",
        patient_speaker_id: initialNote.patient_speaker_id || "Speaker 1",
        needs_review: initialNote.needs_review || false,
        speaker_roles: initialNote.speaker_roles || {},
      });
    }
  }, [initialNote]);

  const handlePlanChange = (idx: number, val: string) => {
    const updatedPlan = [...note.plan];
    updatedPlan[idx] = val;
    setNote({ ...note, plan: updatedPlan });
  };

  const addPlanItem = () => {
    setNote({ ...note, plan: [...note.plan, ""] });
  };

  const handleMedChange = (idx: number, field: keyof SOAPNote["medications"][0], val: string) => {
    const updatedMeds = [...note.medications];
    updatedMeds[idx] = { ...updatedMeds[idx], [field]: val };
    setNote({ ...note, medications: updatedMeds });
  };

  const addMedication = () => {
    setNote({ ...note, medications: [...note.medications, { name: "", dosage: "", frequency: "" }] });
  };

  const handleAllergyChange = (idx: number, val: string) => {
    const updated = [...(note.allergies || [])];
    updated[idx] = val;
    setNote({ ...note, allergies: updated });
  };

  const addAllergy = () => {
    setNote({ ...note, allergies: [...(note.allergies || []), ""] });
  };

  const handleSignOff = async () => {
    setSaving(true);
    try {
      await onSave(note);
    } finally {
      setSaving(false);
    }
  };

  const handleEraseRecord = async () => {
    setErasing(true);
    try {
      await onErase();
    } finally {
      setErasing(false);
    }
  };

  const handleExportNote = () => {
    const textContent = `
CLINICAL SOAP NOTE SUMMARY
==========================
CHIEF COMPLAINT:
${note.chief_complaint}

ALLERGIES & REACTION:
${note.allergies?.join(", ") || "No known drug allergies (NKDA)"}

SUBJECTIVE (HPI):
${note.subjective || note.history_of_present_illness}

OBJECTIVE (PHYSICAL EXAM & VITALS):
${note.objective}

ASSESSMENT & DIAGNOSIS:
${note.assessment}

PRESCRIPTIONS:
${note.medications?.map(m => `- ${m.name} ${m.dosage} (${m.frequency})`).join("\n") || "None prescribed"}

TREATMENT PLAN:
${note.plan?.map((p, i) => `${i + 1}. ${p}`).join("\n")}

FOLLOW-UP:
${note.follow_up}
`;

    const element = document.createElement("a");
    const file = new Blob([textContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `SOAP_Note_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const inputClass = "w-full text-sm bg-white/95 border border-slate-200/90 rounded-2xl p-3 text-slate-800 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition-all duration-200 hover:border-slate-300 shadow-xs placeholder:text-slate-400 font-medium";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable Clinical Note Form Fields */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-6">
        
        {/* Pending / Failed SOAP Generation Alert Banner */}
        {isPendingSoap && onRetrySoap && (
          <div className="p-4.5 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-300/80 rounded-2xl space-y-3 shadow-xs animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100/90 text-amber-800 rounded-xl mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  SOAP Generation Interrupted — Transcript Safe
                </h4>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  The consultation speech was transcribed and preserved in EHR records. You can generate the clinical SOAP note now without re-recording.
                </p>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={onRetrySoap}
                disabled={isRetrying}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating SOAP Note...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Retry SOAP Generation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Speaker Roles Need Review Alert Banner */}
        {note.needs_review && onRemapRoles && (
          <div className="p-4.5 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-300/80 rounded-2xl space-y-3 shadow-xs animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100/90 text-amber-800 rounded-xl mt-0.5 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Speaker roles need confirmation
                </h4>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  Speaker identification is uncertain. Please review the speaker labels in the transcript before finalizing the note.
                </p>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={onRemapRoles}
                disabled={isRemapping}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isRemapping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Remapping Speaker Roles...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Remap Speaker Roles</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Chief Complaint */}
        <div className="group">
          <label className={labelClass}>Chief Complaint</label>
          <input
            type="text"
            value={note.chief_complaint}
            onChange={(e) => setNote({ ...note, chief_complaint: e.target.value })}
            className={inputClass}
            placeholder="e.g., Severe headache & fever for 3 days"
          />
        </div>

        {/* Allergies Alert Section */}
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              Allergies & Adverse Reactions
            </label>
            <button onClick={addAllergy} className="text-xs text-amber-800 hover:text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Allergy
            </button>
          </div>
          <div className="space-y-2">
            {note.allergies?.map((allergy, idx) => (
              <input
                key={idx}
                value={allergy}
                onChange={(e) => handleAllergyChange(idx, e.target.value)}
                className={`${inputClass} !p-2.5 !text-xs border-amber-200 focus:ring-amber-500`}
                placeholder="e.g., Penicillin, NSAIDs"
              />
            ))}
            {(!note.allergies || note.allergies.length === 0) && (
              <p className="text-xs text-amber-700/80 italic font-medium">No known drug allergies recorded (NKDA).</p>
            )}
          </div>
        </div>

        {/* Subjective */}
        <div className="group">
          <label className={labelClass}>Subjective (HPI)</label>
          <textarea
            rows={3}
            value={note.subjective || note.history_of_present_illness}
            onChange={(e) => setNote({ ...note, subjective: e.target.value, history_of_present_illness: e.target.value })}
            className={`${inputClass} resize-none`}
            placeholder="Patient reports symptoms, duration, triggers..."
          />
        </div>

        {/* Objective (Physical Exam / Vitals) */}
        <div className="group">
          <label className={labelClass}>Objective (Physical Exam & Vitals)</label>
          <textarea
            rows={2}
            value={note.objective}
            onChange={(e) => setNote({ ...note, objective: e.target.value })}
            className={`${inputClass} resize-none`}
            placeholder="BP: 120/80, Temp: 98.6°F, HR: 72 bpm. Exam findings..."
          />
        </div>

        {/* Assessment Section (High Clinical Emphasis) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200/80 shadow-sm space-y-2">
          <label className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
            Assessment & Clinical Diagnosis
          </label>
          <textarea
            rows={2}
            value={note.assessment}
            onChange={(e) => setNote({ ...note, assessment: e.target.value })}
            className={`${inputClass} !bg-white border-emerald-200 focus:ring-emerald-500 font-bold text-emerald-950 resize-none`}
            placeholder="e.g., 1. Acute Tension Headache 2. Mild Low-Grade Pyrexia"
          />
        </div>

        {/* Medications Table */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Prescriptions (Medications)</label>
            <button onClick={addMedication} className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Rx
            </button>
          </div>
          <div className="space-y-2">
            {note.medications?.map((med, idx) => (
              <div key={idx} className="flex items-center gap-2 group/rx">
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                  <input placeholder="Medication" value={med.name} onChange={(e) => handleMedChange(idx, "name", e.target.value)} className={`${inputClass} !p-2 !text-xs`} />
                  <input placeholder="Dose (650mg)" value={med.dosage} onChange={(e) => handleMedChange(idx, "dosage", e.target.value)} className={`${inputClass} !p-2 !text-xs`} />
                  <input placeholder="Freq (TID PRN)" value={med.frequency} onChange={(e) => handleMedChange(idx, "frequency", e.target.value)} className={`${inputClass} !p-2 !text-xs`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Section (High Clinical Emphasis) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
              Treatment Plan & Instructions
            </label>
            <button onClick={addPlanItem} className="text-xs text-indigo-700 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Plan Step
            </button>
          </div>
          <div className="space-y-2">
            {note.plan?.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 w-4">{idx + 1}.</span>
                <input
                  value={step}
                  onChange={(e) => handlePlanChange(idx, e.target.value)}
                  className={`${inputClass} !p-2.5 !text-xs border-indigo-200 focus:ring-indigo-500`}
                  placeholder="Treatment recommendation..."
                />
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up */}
        <div className="group">
          <label className={labelClass}>Follow-Up Plan</label>
          <input
            type="text"
            value={note.follow_up}
            onChange={(e) => setNote({ ...note, follow_up: e.target.value })}
            className={inputClass}
            placeholder="e.g., Return in 3-5 days or PRN if symptoms worsen"
          />
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportNote}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            title="Download formatted text summary"
          >
            <Download className="w-4 h-4" /> Export .txt
          </button>

          <button
            onClick={handleEraseRecord}
            disabled={erasing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            title="Permanently purge under DPDP Act 2023"
          >
            <Trash2 className="w-4 h-4" /> Purge Record
          </button>

          {hasSpeakerCorrection && onRegenerateSoap && (
            <button
              onClick={onRegenerateSoap}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              title="Regenerate clinical note using corrected speaker roles"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate SOAP</span>
                </>
              )}
            </button>
          )}
        </div>

        <button
          onClick={handleSignOff}
          disabled={saving || isFinalized}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer ${
            isFinalized
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-none cursor-default"
              : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-500/25"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Signing..." : isFinalized ? "Signed & Finalized" : "Sign & Finalize Record"}
        </button>
      </div>
    </div>
  );
}