"use client";
import React, { useState } from "react";
import { User, Stethoscope, Clock, Search } from "lucide-react";
import { Utterance } from "@/lib/types";

interface TranscriptViewerProps {
  utterances: Utterance[];
  doctorSpeakerId?: string;
  patientSpeakerId?: string;
  onSelectSpeaker?: (speaker: "clinician" | "patient") => void;
}

export default function TranscriptViewer({ utterances, doctorSpeakerId, patientSpeakerId, onSelectSpeaker }: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");

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

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Transcript Search Filter */}
      <div className="relative shrink-0">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter spoken transcript..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50/80 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-gray-400"
        />
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {filteredUtterances.map((utt, idx) => {
          const speakerTag = `Speaker ${utt.speaker}`;
          const isDoctor = doctorSpeakerId ? speakerTag === doctorSpeakerId : utt.speaker === 0;
          const speakerType = isDoctor ? "clinician" : "patient";

          return (
            <div
              key={idx}
              onMouseEnter={() => onSelectSpeaker && onSelectSpeaker(speakerType)}
              onClick={() => onSelectSpeaker && onSelectSpeaker(speakerType)}
              className={`flex flex-col group animate-fade-in-up cursor-pointer ${
                isDoctor ? "items-start pr-12" : "items-end pl-12"
              }`}
              style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}
            >
              <div className="flex items-center gap-2 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                {isDoctor && <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />}
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isDoctor ? "text-emerald-700" : "text-indigo-700"}`}>
                  {isDoctor ? "Clinician" : "Patient"}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {utt.start.toFixed(1)}s
                </span>
                {!isDoctor && <User className="w-3.5 h-3.5 text-indigo-600" />}
              </div>
              
              <div
                className={`p-4 text-sm leading-relaxed shadow-sm transition-all duration-200 hover:shadow-md relative ${
                  isDoctor 
                    ? "bg-white/95 border border-emerald-200/90 rounded-2xl rounded-tl-sm text-slate-800 group-hover:border-emerald-400 shadow-slate-900/5" 
                    : "bg-gradient-to-br from-indigo-50/90 via-blue-50/70 to-indigo-50/50 border border-indigo-200/90 rounded-2xl rounded-tr-sm text-indigo-950 group-hover:border-indigo-400 shadow-slate-900/5"
                }`}
              >
                {isDoctor && (
                  <div className="absolute top-0 left-0 -ml-1.5 -mt-1.5 w-3 h-3 bg-white border-l border-t border-emerald-100 transform rotate-45"></div>
                )}
                {!isDoctor && (
                  <div className="absolute top-0 right-0 -mr-1.5 -mt-1.5 w-3 h-3 bg-indigo-50 border-r border-t border-indigo-100 transform rotate-45"></div>
                )}
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