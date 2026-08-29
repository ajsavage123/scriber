"use client";
import React, { useState } from "react";
import { User, Stethoscope, Clock, Search, Globe, ShieldCheck, HelpCircle, MessageSquare } from "lucide-react";
import { Utterance } from "@/lib/types";

interface TranscriptViewerProps {
  utterances: Utterance[];
  doctorSpeakerId?: string;
  patientSpeakerId?: string;
  speakerRoles?: Record<string, { role: string; confidence: number }>;
  onUpdateSpeakerRoles?: (
    speakerRoles: Record<string, { role: string; confidence: number }>,
    doctorSpeakerId: string,
    patientSpeakerId: string
  ) => void;
  onSelectSpeaker?: (speaker: "clinician" | "patient") => void;
}

export default function TranscriptViewer({
  utterances,
  doctorSpeakerId,
  patientSpeakerId,
  speakerRoles = {},
  onUpdateSpeakerRoles,
  onSelectSpeaker
}: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [applyToAllMap, setApplyToAllMap] = useState<Record<string, boolean>>({});
  const [sentenceOverrides, setSentenceOverrides] = useState<Record<number, string>>({});

  if (!utterances || utterances.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">No transcript available yet.</p>
        <p className="text-gray-400 text-sm mt-1">Start recording to capture the conversation.</p>
      </div>
    );
  }

  const filteredUtterances = utterances.filter(u => 
    u.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "doctor":
        return <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />;
      case "patient":
        return <User className="w-3.5 h-3.5 text-indigo-600" />;
      case "caregiver":
        return <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />;
      case "interpreter":
        return <Globe className="w-3.5 h-3.5 text-blue-600" />;
      case "other":
        return <MessageSquare className="w-3.5 h-3.5 text-slate-600" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "doctor": return "Clinician";
      case "patient": return "Patient";
      case "caregiver": return "Caregiver";
      case "interpreter": return "Interpreter";
      case "other": return "Other";
      default: return "Unknown";
    }
  };

  const handleRoleChange = (rawSpeakerId: string, sentenceIndex: number, newRole: string) => {
    const shouldApplyToAll = applyToAllMap[rawSpeakerId] !== false;

    if (shouldApplyToAll) {
      // Clear any sentence-level overrides for this speaker to keep them synchronized
      const updatedSentenceOverrides = { ...sentenceOverrides };
      utterances.forEach((u, i) => {
        const uSpk = u.raw_speaker_id || `Speaker ${u.speaker}`;
        if (uSpk === rawSpeakerId) {
          delete updatedSentenceOverrides[i];
        }
      });
      setSentenceOverrides(updatedSentenceOverrides);

      // Construct new speaker_roles object
      const updatedSpeakerRoles = {
        ...speakerRoles,
        [rawSpeakerId]: { role: newRole, confidence: 1.0 }
      };

      // Determine updated primary ids
      let updatedDoctorId = doctorSpeakerId || "";
      let updatedPatientId = patientSpeakerId || "";

      if (newRole === "doctor") {
        updatedDoctorId = rawSpeakerId;
        if (updatedPatientId === rawSpeakerId) updatedPatientId = "";
      } else if (newRole === "patient") {
        updatedPatientId = rawSpeakerId;
        if (updatedDoctorId === rawSpeakerId) updatedDoctorId = "";
      } else {
        // If it was changed away from doctor/patient
        if (updatedDoctorId === rawSpeakerId) updatedDoctorId = "";
        if (updatedPatientId === rawSpeakerId) updatedPatientId = "";
      }

      if (onUpdateSpeakerRoles) {
        onUpdateSpeakerRoles(updatedSpeakerRoles, updatedDoctorId, updatedPatientId);
      }
    } else {
      // Sentence override
      setSentenceOverrides(prev => ({
        ...prev,
        [sentenceIndex]: newRole
      }));
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Transcript Search Filter */}
      <div className="relative shrink-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter spoken transcript..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/90 border border-slate-200/90 rounded-full outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400 font-medium shadow-xs"
        />
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {filteredUtterances.map((utt, idx) => {
          const rawSpeakerId = utt.raw_speaker_id || `Speaker ${utt.speaker}`;
          
          // Determine the role for this utterance (respecting overrides first)
          const overrideRole = sentenceOverrides[idx];
          const mappedRoleInfo = speakerRoles[rawSpeakerId];
          
          let role = "unknown";
          if (overrideRole) {
            role = overrideRole;
          } else if (mappedRoleInfo) {
            role = mappedRoleInfo.role;
          } else if (rawSpeakerId === doctorSpeakerId) {
            role = "doctor";
          } else if (rawSpeakerId === patientSpeakerId) {
            role = "patient";
          } else if (utt.speaker === 0) {
            role = "doctor";
          } else if (utt.speaker === 1) {
            role = "patient";
          }

          const isDoctor = role === "doctor";
          const speakerType = isDoctor ? "clinician" : "patient";
          const isApplyToAllChecked = applyToAllMap[rawSpeakerId] !== false;

          return (
            <div
              key={idx}
              onMouseEnter={() => onSelectSpeaker && onSelectSpeaker(speakerType)}
              onClick={() => onSelectSpeaker && onSelectSpeaker(speakerType)}
              className={`flex flex-col group animate-fade-in-up cursor-pointer ${
                isDoctor ? "items-start pr-10" : "items-end pl-10"
              }`}
              style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}
            >
              {/* Speaker Metadata Header with Custom Dropdown & Toggle */}
              <div className="flex items-center flex-wrap gap-2 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                {getRoleIcon(role)}
                
                <span className="text-[10px] text-gray-400 font-mono font-bold uppercase">
                  {rawSpeakerId}
                </span>

                {/* Edit Dropdown */}
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(rawSpeakerId, idx, e.target.value)}
                  className={`text-[10px] font-bold uppercase tracking-wider bg-transparent border-none py-0.5 px-2 outline-none cursor-pointer focus:ring-0 rounded-full hover:bg-gray-100/80 transition-colors ${
                    role === "doctor"
                      ? "text-emerald-700 font-bold"
                      : role === "patient"
                      ? "text-indigo-700 font-bold"
                      : "text-slate-600 font-bold"
                  }`}
                >
                  <option value="doctor">Clinician</option>
                  <option value="patient">Patient</option>
                  <option value="caregiver">Caregiver</option>
                  <option value="interpreter">Interpreter</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>

                {/* Apply to All checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[9px] text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200/80 px-2 py-0.5 rounded-full transition-all">
                  <input
                    type="checkbox"
                    checked={isApplyToAllChecked}
                    onChange={(e) => {
                      setApplyToAllMap(prev => ({
                        ...prev,
                        [rawSpeakerId]: e.target.checked
                      }));
                    }}
                    className="w-2.5 h-2.5 rounded-full border-gray-300 text-emerald-600 focus:ring-emerald-500/50 cursor-pointer"
                  />
                  <span>Apply to all</span>
                </label>

                <span className="text-[10px] text-gray-400 font-mono">
                  {utt.start.toFixed(1)}s
                </span>
              </div>
              
              <div
                className={`p-4 text-sm leading-relaxed shadow-sm transition-all duration-200 hover:shadow-md relative rounded-[24px] ${
                  isDoctor 
                    ? "bg-white/95 border border-emerald-200/90 text-slate-800 group-hover:border-emerald-400 shadow-slate-900/5" 
                    : "bg-gradient-to-br from-indigo-50/90 via-blue-50/70 to-indigo-50/50 border border-indigo-200/90 text-indigo-950 group-hover:border-indigo-400 shadow-slate-900/5"
                }`}
              >
                <p className="relative z-10">{utt.text}</p>
              </div>
            </div>
          );
        })}

        {filteredUtterances.length === 0 && (
          <p className="text-xs text-center text-gray-400 py-6">No matching spoken text found for "{searchTerm}".</p>
        )}
      </div>
    </div>
  );
}