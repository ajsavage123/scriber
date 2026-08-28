"use client";
import React from "react";
import { User, Stethoscope, Clock } from "lucide-react";
import { Utterance } from "@/lib/types";

interface TranscriptViewerProps {
  utterances: Utterance[];
  doctorSpeakerId?: string;
  patientSpeakerId?: string;
}

export default function TranscriptViewer({ utterances, doctorSpeakerId, patientSpeakerId }: TranscriptViewerProps) {
  if (!utterances || utterances.length === 0) {
    return <div className="text-gray-400 italic text-sm p-4 text-center">No transcript available yet.</div>;
  }

  return (
    <div className="space-y-3 max-h-[550px] overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-200">
      {utterances.map((utt, idx) => {
        const speakerTag = `Speaker ${utt.speaker}`;
        const isDoctor = doctorSpeakerId ? speakerTag === doctorSpeakerId : utt.speaker === 0;

        return (
          <div
            key={idx}
            className={`p-3.5 rounded-xl text-sm transition ${
              isDoctor ? "bg-emerald-50/80 border border-emerald-200 ml-4" : "bg-white border border-gray-200 mr-4 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className={`flex items-center gap-1.5 font-bold ${isDoctor ? "text-emerald-800" : "text-blue-800"}`}>
                {isDoctor ? <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> : <User className="w-3.5 h-3.5 text-blue-600" />}
                {isDoctor ? "Doctor / Clinician" : "Patient"} <span className="text-gray-400 font-normal">({speakerTag})</span>
              </span>
              <span className="flex items-center gap-1 text-gray-400 text-[11px]">
                <Clock className="w-3 h-3" /> {utt.start.toFixed(1)}s - {utt.end.toFixed(1)}s
              </span>
            </div>
            <p className="text-gray-800 leading-relaxed font-sans">{utt.text}</p>
          </div>
        );
      })}
    </div>
  );
}