"use client";

import React from "react";
import { Stethoscope, User, Mic } from "lucide-react";
import SiriWaveformVisualizer from "./SiriWaveformVisualizer";

export type ActiveSpeaker = "clinician" | "patient" | "both" | "none";

interface SpeakerAmbientVisualizerProps {
  activeSpeaker?: ActiveSpeaker;
  audioLevel?: number; // 0.0 to 1.0
  pitch?: number; // 0.0 to 1.0 real-time vocal pitch
  isRecording?: boolean;
  isPaused?: boolean;
  frequencies?: number[]; // Real-time frequency spectrum array [0..1]
  className?: string;
  children?: React.ReactNode;
}

export default function SpeakerAmbientVisualizer({
  activeSpeaker = "none",
  audioLevel = 0,
  pitch = 0.4,
  isRecording = false,
  isPaused = false,
  frequencies = [],
  className = "",
  children,
}: SpeakerAmbientVisualizerProps) {
  // Status labels & badges based on active speaker
  const getSpeakerStatus = () => {
    if (isPaused) {
      return {
        label: "Recording Paused",
        dot: "bg-amber-400 shadow-[0_0_8px_#f59e0b]",
        pill: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      };
    }
    if (!isRecording) {
      return {
        label: "Visualizer Standby",
        dot: "bg-slate-500",
        pill: "bg-slate-900/60 text-slate-400 border-slate-700/50",
      };
    }
    switch (activeSpeaker) {
      case "clinician":
        return {
          label: "Clinician Speaking",
          dot: "bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]",
          pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
        };
      case "patient":
        return {
          label: "Patient Speaking",
          dot: "bg-pink-400 animate-pulse shadow-[0_0_10px_#ec4899]",
          pill: "bg-pink-500/15 text-pink-300 border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.2)]",
        };
      case "both":
        return {
          label: "Simultaneous Dialogue",
          dot: "bg-gradient-to-r from-cyan-400 to-pink-400 animate-pulse shadow-[0_0_12px_#a855f7]",
          pill: "bg-purple-500/15 text-purple-200 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]",
        };
      case "none":
      default:
        return {
          label: "Live Ambient Listening...",
          dot: "bg-cyan-400 animate-ping shadow-[0_0_8px_#06b6d4]",
          pill: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]",
        };
    }
  };

  const status = getSpeakerStatus();

  return (
    <div className={`relative w-full h-full flex-1 rounded-[28px] sm:rounded-[36px] overflow-hidden window-3d-dark flex flex-col justify-between ${className}`}>
      {/* Siri Canvas Waveform Engine - Edge-to-Edge Inside 3D Curved Window */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <SiriWaveformVisualizer
          activeSpeaker={activeSpeaker}
          audioLevel={audioLevel}
          pitch={pitch}
          frequencies={frequencies}
          isRecording={isRecording}
          isPaused={isPaused}
          className="w-full h-full"
        />
      </div>

      {/* Floating HUD Badges & Indicators Layer (3D Glass Tiles) */}
      <div className="relative z-10 p-4 sm:p-7 flex flex-col justify-between flex-1 h-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          {/* Clinician Badge (Left - 3D Soft Bevel) */}
          <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-300 backdrop-blur-xl shadow-lg ${
            !isPaused && (activeSpeaker === "clinician" || activeSpeaker === "both")
              ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-105"
              : "bg-slate-900/80 text-slate-400 border-slate-700/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] opacity-70"
          }`}>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold leading-tight">Clinician</p>
              <p className="text-[10px] text-emerald-400/80 font-medium">Speaker 0</p>
            </div>
          </div>

          {/* Center Status Pill (3D Soft Bevel) */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-all duration-300 backdrop-blur-xl shadow-lg ${status.pill} shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span>{status.label}</span>
          </div>

          {/* Patient Badge (Right - 3D Soft Bevel) */}
          <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-300 backdrop-blur-xl shadow-lg ${
            !isPaused && (activeSpeaker === "patient" || activeSpeaker === "both")
              ? "bg-pink-500/25 text-pink-300 border-pink-400/60 shadow-[0_0_25px_rgba(236,72,153,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-105"
              : "bg-slate-900/80 text-slate-400 border-slate-700/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] opacity-70"
          }`}>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold leading-tight">Patient</p>
              <p className="text-[10px] text-pink-400/80 font-medium">Speaker 1</p>
            </div>
            <div className="w-7 h-7 rounded-xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center text-pink-400 shadow-inner">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Dynamic Center Zone */}
        <div className="flex-1 min-h-[60px] pointer-events-none" />

        {/* Bottom Actions & Indicator Section */}
        <div className="space-y-4 pt-2 pb-6 sm:pb-8">
          {/* Action Button Controls (Embedded in Siri Studio) */}
          {children && (
            <div className="flex items-center justify-center pb-2">
              {children}
            </div>
          )}

          {/* Bottom Ambient Glow Bar Indicator */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400/80 px-2 pt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400/70 animate-pulse shadow-[0_0_8px_#06b6d4]"></span>
              <span className="hidden sm:inline text-slate-400">Multi-Harmonic Real-Time Audio Engine</span>
            </div>
            <div className="flex items-center gap-2 font-semibold text-slate-300">
              <span>{isRecording ? (!isPaused ? `${(audioLevel * 100).toFixed(0)}% Audio Energy` : "PAUSED") : "READY"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
