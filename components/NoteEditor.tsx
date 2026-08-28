"use client";
import React, { useState } from "react";
import { SOAPNote } from "@/lib/types";
import { CheckCircle2, Trash2, Plus, AlertCircle } from "lucide-react";

interface NoteEditorProps {
  initialNote: SOAPNote;
  onSave: (finalNote: SOAPNote) => Promise<void>;
  onErase: () => Promise<void>;
  isFinalized?: boolean;
}

export default function NoteEditor({ initialNote, onSave, onErase, isFinalized = false }: NoteEditorProps) {
  const [note, setNote] = useState<SOAPNote>(initialNote);
  const [saving, setSaving] = useState(false);
  const [erasing, setErasing] = useState(false);

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

  const handleSignOff = async () => {
    setSaving(true);
    try {
      await onSave(note);
    } finally {
      setSaving(false);
    }
  };

  const handleEraseRecord = async () => {
    if (confirm("Are you sure? This will permanently delete this medical record under DPDP Act.")) {
      setErasing(true);
      try {
        await onErase();
      } finally {
        setErasing(false);
      }
    }
  };

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-5">
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Clinical SOAP Note</h3>
          <p className="text-xs text-gray-500">Standardized Medical English Output</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isFinalized ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {isFinalized ? "Signed & Approved" : "AI Draft (Review Required)"}
        </span>
      </div>

      {/* Chief Complaint */}
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Chief Complaint</label>
        <input
          type="text"
          value={note.chief_complaint}
          onChange={(e) => setNote({ ...note, chief_complaint: e.target.value })}
          className="w-full text-sm border rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Subjective */}
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Subjective (HPI)</label>
        <textarea
          rows={3}
          value={note.subjective || note.history_of_present_illness}
          onChange={(e) => setNote({ ...note, subjective: e.target.value, history_of_present_illness: e.target.value })}
          className="w-full text-sm border rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Assessment */}
      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Assessment / Diagnosis</label>
        <input
          type="text"
          value={note.assessment}
          onChange={(e) => setNote({ ...note, assessment: e.target.value })}
          className="w-full text-sm border rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Medications Table */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Prescribed Medications</label>
          <button onClick={addMedication} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Drug
          </button>
        </div>
        <div className="space-y-2">
          {note.medications?.map((med, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-2">
              <input
                placeholder="Medicine Name"
                value={med.name}
                onChange={(e) => handleMedChange(idx, "name", e.target.value)}
                className="text-xs border rounded-md p-2"
              />
              <input
                placeholder="Dosage (e.g., 500mg)"
                value={med.dosage}
                onChange={(e) => handleMedChange(idx, "dosage", e.target.value)}
                className="text-xs border rounded-md p-2"
              />
              <input
                placeholder="Frequency (e.g., BID)"
                value={med.frequency}
                onChange={(e) => handleMedChange(idx, "frequency", e.target.value)}
                className="text-xs border rounded-md p-2"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Plan */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Treatment Plan & Advice</label>
          <button onClick={addPlanItem} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Step
          </button>
        </div>
        <div className="space-y-1.5">
          {note.plan?.map((step, idx) => (
            <input
              key={idx}
              value={step}
              onChange={(e) => handlePlanChange(idx, e.target.value)}
              className="w-full text-xs border rounded-md p-2"
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t flex items-center justify-between gap-3">
        <button
          onClick={handleEraseRecord}
          disabled={erasing}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition"
        >
          <Trash2 className="w-4 h-4" /> {erasing ? "Purging..." : "Erase (DPDP)"}
        </button>

        <button
          onClick={handleSignOff}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md transition"
        >
          <CheckCircle2 className="w-4 h-4" /> {saving ? "Saving..." : "Sign & Finalize Record"}
        </button>
      </div>
    </div>
  );
}