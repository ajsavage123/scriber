"use client";

import React, { useEffect, useState } from "react";
import { Stethoscope, User, Mic, Volume2 } from "lucide-react";

export type ActiveSpeaker = "clinician" | "patient" | "both" | "none";

interface SpeakerAmbientVisualizerProps {
  activeSpeaker?: ActiveSpeaker;
  audioLevel?: number; // 0.0 to 1.0
  isRecording?: boolean;
  isPaused?: boolean;
  frequencies?: number[]; // Real-time frequency spectrum array [0..1]
  className?: string;
}

export default function SpeakerAmbientVisualizer({
  activeSpeaker = "none",
  audioLevel = 0,
  isRecording = false,
  isPaused = false,
  className = "",
}: SpeakerAmbientVisualizerProps) {
  // Clamp audioLevel between 0 and 1 (forced 0 when paused)
  const level = isPaused ? 0 : Math.max(0, Math.min(1, audioLevel));
  const scaleFactor = isPaused ? 1 : 1 + level * 0.45; // Voice intensity amplitude scaling

  // Time phase for smooth continuous wave animation
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      if (isPaused) {
        // Freeze animation phase immediately when paused
        return;
      }
      // Dynamic wave speed scaling with real-time vocal energy
      const baseSpeed = activeSpeaker === "patient" ? 1.4 : activeSpeaker === "both" ? 1.8 : 1.1;
      const speed = isRecording ? (baseSpeed + level * 2.8) : 0.6;
      setPhase((prev) => (prev + delta * speed) % (Math.PI * 2));
      animId = requestAnimationFrame(loop);
    };

    if (!isPaused) {
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [isRecording, level, activeSpeaker, isPaused]);

  // Color & Gradient States based on active speaker & pause state
  const getSpeakerTheme = () => {
    if (isPaused) {
      return {
        bg: "from-slate-900/10 via-slate-950/15 to-slate-900/10",
        strokePrimary: "#f59e0b",
        strokeSecondary: "#d97706",
        gradientId: "pausedGrad",
        glowLeft: "opacity-15 scale-95 bg-slate-400/10",
        glowRight: "opacity-15 scale-95 bg-slate-400/10",
        badgeBg: "bg-amber-500/10 text-amber-800 border-amber-300/40",
        badgeDot: "bg-amber-500",
        label: "Recording Paused",
        barColor: "bg-amber-400/30",
      };
    }

    switch (activeSpeaker) {
      case "clinician":
        return {
          bg: "from-emerald-950/25 via-teal-900/20 to-emerald-900/15",
          strokePrimary: "#10b981",
          strokeSecondary: "#2dd4bf",
          gradientId: "clinicianGrad",
          glowLeft: "opacity-100 scale-125 bg-emerald-400/45",
          glowRight: "opacity-20 scale-90 bg-teal-300/15",
          badgeBg: "bg-emerald-500/10 text-emerald-800 border-emerald-300/40",
          badgeDot: "bg-emerald-500 animate-pulse",
          label: "Clinician Speaking",
          barColor: "bg-gradient-to-t from-emerald-600 via-emerald-400 to-teal-300",
        };
      case "patient":
        return {
          bg: "from-indigo-950/25 via-blue-900/20 to-indigo-900/15",
          strokePrimary: "#6366f1",
          strokeSecondary: "#38bdf8",
          gradientId: "patientGrad",
          glowLeft: "opacity-20 scale-90 bg-indigo-300/15",
          glowRight: "opacity-100 scale-125 bg-indigo-400/45",
          badgeBg: "bg-indigo-500/10 text-indigo-800 border-indigo-300/40",
          badgeDot: "bg-indigo-500 animate-pulse",
          label: "Patient Speaking",
          barColor: "bg-gradient-to-t from-indigo-600 via-indigo-400 to-sky-300",
        };
      case "both":
        return {
          bg: "from-purple-950/25 via-indigo-900/20 to-emerald-900/15",
          strokePrimary: "#a855f7",
          strokeSecondary: "#ec4899",
          gradientId: "bothGrad",
          glowLeft: "opacity-90 scale-110 bg-emerald-400/35",
          glowRight: "opacity-90 scale-110 bg-indigo-400/35",
          badgeBg: "bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 text-purple-900 border-purple-300/40",
          badgeDot: "bg-gradient-to-r from-emerald-500 to-indigo-500 animate-pulse",
          label: "Simultaneous Dialogue",
          barColor: "bg-gradient-to-t from-emerald-500 via-purple-500 to-pink-400",
        };
      case "none":
      default:
        return {
          bg: isRecording
            ? "from-emerald-950/15 via-cyan-900/15 to-teal-900/10"
            : "from-slate-100/40 via-gray-100/30 to-slate-50/20",
          strokePrimary: isRecording ? "#14b8a6" : "#cbd5e1",
          strokeSecondary: isRecording ? "#06b6d4" : "#e2e8f0",
          gradientId: "ambientGrad",
          glowLeft: isRecording ? "opacity-50 scale-105 bg-teal-400/25" : "opacity-20 scale-95 bg-slate-300/20",
          glowRight: isRecording ? "opacity-50 scale-105 bg-emerald-400/25" : "opacity-20 scale-95 bg-slate-300/20",
          badgeBg: "bg-gray-100/80 text-gray-600 border-gray-200",
          badgeDot: isRecording ? "bg-emerald-500 animate-ping" : "bg-gray-400",
          label: isRecording ? "Live Ambient Listening..." : "Visualizer Standby",
          barColor: "bg-emerald-400/70",
        };
    }
  };

  const theme = getSpeakerTheme();

  // Helper to compute Upward-Shooting Wave Path with Speaker-Specific Pitch & Resonance Modulations
  const generateUpwardWavePath = (
    width: number,
    height: number,
    maxAmplitude: number,
    frequency: number,
    phaseOffset: number
  ) => {
    if (isPaused) {
      // Pure crisp flat horizontal baseline across the width floor (y = height - 14)
      return `M 0 ${(height - 14).toFixed(1)} L ${width} ${(height - 14).toFixed(1)}`;
    }

    const points: string[] = [];
    const baseY = height - 14; // Bottom baseline floor
    const steps = 80;

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const normX = i / steps;
      // Envelope tapering left & right edges to baseline floor
      const envelope = Math.sin(normX * Math.PI);
      
      let wave1 = 0;
      let wave2 = 0;
      let wave3 = 0;

      if (activeSpeaker === "clinician") {
        wave1 = Math.sin(normX * Math.PI * 2 * frequency + phase + phaseOffset);
        wave2 = Math.sin(normX * Math.PI * 3.8 * frequency + phase * 1.4 + phaseOffset) * 0.4;
        wave3 = Math.cos(normX * Math.PI * 5.2 * frequency + phase * 0.8) * 0.2;
      } else if (activeSpeaker === "patient") {
        wave1 = Math.sin(normX * Math.PI * 2.8 * frequency + phase * 1.3 + phaseOffset);
        wave2 = Math.sin(normX * Math.PI * 5.5 * frequency + phase * 2.1 + phaseOffset) * 0.55;
        wave3 = Math.abs(Math.sin(normX * Math.PI * 8.0 * frequency + phase * 2.8)) * 0.35;
      } else if (activeSpeaker === "both") {
        wave1 = Math.sin(normX * Math.PI * 2.2 * frequency + phase + phaseOffset);
        wave2 = Math.sin(normX * Math.PI * 4.8 * frequency - phase * 1.8 + phaseOffset) * 0.6;
        wave3 = Math.sin(normX * Math.PI * 7.5 * frequency + phase * 3.1) * 0.4;
      } else {
        wave1 = Math.sin(normX * Math.PI * 1.8 * frequency + phase * 0.8 + phaseOffset);
        wave2 = Math.cos(normX * Math.PI * 3.2 * frequency + phase * 0.5) * 0.3;
      }

      const waveHeight = Math.abs(wave1 + wave2 + wave3) * maxAmplitude * envelope;
      const y = Math.max(6, baseY - waveHeight);

      if (i === 0) {
        points.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
      } else {
        points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
    }

    return points.join(" ");
  };

  // Generate 24 dynamic frequency spectrum bars (collapsed to flat floor when paused)
  const barCount = 24;
  const bars = Array.from({ length: barCount }).map((_, i) => {
    if (isPaused) return 4; // Immediately collapse bars to flat floor when paused
    const normIndex = i / barCount;
    let pitchFactor = 0.5;

    if (activeSpeaker === "clinician") {
      pitchFactor = 0.4 + Math.sin(normIndex * Math.PI * 2 + phase * 2) * 0.5 + (i >= 6 && i <= 16 ? 0.3 : 0);
    } else if (activeSpeaker === "patient") {
      pitchFactor = 0.3 + Math.sin(normIndex * Math.PI * 4 + phase * 3) * 0.6 + (i > 12 ? 0.25 : 0);
    } else if (activeSpeaker === "both") {
      pitchFactor = 0.6 + Math.sin(normIndex * Math.PI * 5 + phase * 3.5) * 0.4;
    } else {
      pitchFactor = 0.2 + Math.sin(normIndex * Math.PI * 2 + phase) * 0.2;
    }

    const baseAmp = level > 0.01 ? level : 0.05;
    const barHeight = Math.max(8, Math.min(100, (baseAmp * 95 * pitchFactor) + (Math.sin(i + phase * 4) * 14)));
    return barHeight;
  });

  return (
    <div
      aria-label={`Speaker status: ${theme.label}`}
      className={`relative w-full h-32 rounded-2xl overflow-hidden border border-white/80 shadow-md transition-all duration-500 ease-in-out bg-gradient-to-r ${theme.bg} ${className}`}
    >
      {/* Dynamic Color Gradient Definitions */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <linearGradient id="clinicianGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#14b8a6" stopOpacity="1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="patientGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="bothGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="ambientGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="pausedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="waveFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={theme.strokePrimary} stopOpacity="0.35" />
            <stop offset="100%" stopColor={theme.strokeSecondary} stopOpacity="0.05" />
          </linearGradient>
        </defs>
      </svg>

      {/* Background Ambient Glowing Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Clinician Left Orb */}
        <div
          className={`absolute -left-12 -top-12 w-52 h-52 rounded-full blur-3xl transition-all duration-500 ease-out ${theme.glowLeft}`}
          style={{ transform: `scale(${activeSpeaker === "clinician" || activeSpeaker === "both" ? scaleFactor : 1})` }}
        />

        {/* Patient Right Orb */}
        <div
          className={`absolute -right-12 -bottom-12 w-52 h-52 rounded-full blur-3xl transition-all duration-500 ease-out ${theme.glowRight}`}
          style={{ transform: `scale(${activeSpeaker === "patient" || activeSpeaker === "both" ? scaleFactor : 1})` }}
        />

        {/* Continuous Dynamic Upward SVG Waveform Canvas */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 600 128" preserveAspectRatio="none">
            {/* Background Filled Wave Area - Only visible during active recording */}
            {isRecording && !isPaused && (
              <path
                d={`M 0 128 ${generateUpwardWavePath(600, 128, Math.max(18, level * 78), 2.2, 0)} L 600 128 Z`}
                fill="url(#waveFill)"
              />
            )}

            {/* Secondary Wave Line (Hidden when paused) */}
            {!isPaused && (
              <path
                d={generateUpwardWavePath(
                  600,
                  128,
                  isRecording ? Math.max(10, level * 50) : 5,
                  isRecording ? 1.8 : 1.2,
                  Math.PI / 3
                )}
                fill="none"
                stroke={theme.strokeSecondary}
                strokeWidth={isRecording ? "2" : "1"}
                strokeOpacity={isRecording ? "0.6" : "0.25"}
              />
            )}

            {/* Primary Upward Wave Line (Pure flat horizontal baseline line when paused) */}
            <path
              d={generateUpwardWavePath(
                600,
                128,
                isRecording && !isPaused ? Math.max(20, level * 85) : 0,
                isRecording && !isPaused ? (activeSpeaker === "both" ? 3.2 : 2.5) : 1.5,
                0
              )}
              fill="none"
              stroke={isPaused ? "#f59e0b" : `url(#${theme.gradientId})`}
              strokeWidth={isPaused ? "2.5" : (isRecording ? "3.5" : "1.5")}
              strokeDasharray={isPaused ? "6 4" : "none"}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
        </div>
      </div>

      {/* Visualizer Header Controls & Dynamic Badges */}
      <div className="relative z-10 h-full px-6 py-3 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          {/* Clinician Speaker Badge */}
          <div className={`flex items-center gap-2 transition-all duration-300 ${
            !isPaused && (activeSpeaker === "clinician" || activeSpeaker === "both") ? "opacity-100 scale-105" : "opacity-50 scale-95"
          }`}>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 shadow-sm backdrop-blur-md">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-emerald-950 leading-tight">Clinician</p>
              <p className="text-[10px] text-emerald-700 font-semibold">Speaker A</p>
            </div>
          </div>

          {/* Center Clean Professional Status Pill Badge */}
          <div className="flex items-center justify-center">
            <div className={`flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-bold shadow-md transition-all duration-300 backdrop-blur-md ${theme.badgeBg}`}>
              <span>{theme.label}</span>
              <span className={`w-2 h-2 rounded-full ${theme.badgeDot}`} />
            </div>
          </div>

          {/* Patient Speaker Badge */}
          <div className={`flex items-center gap-2 transition-all duration-300 ${
            !isPaused && (activeSpeaker === "patient" || activeSpeaker === "both") ? "opacity-100 scale-105" : "opacity-50 scale-95"
          }`}>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-indigo-950 leading-tight">Patient</p>
              <p className="text-[10px] text-indigo-700 font-semibold">Speaker B</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700 shadow-sm backdrop-blur-md">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Real-Time Pitch & Volume Frequency Equalizer Bars (Collapses to flat floor when paused) */}
        <div className="flex items-end justify-center gap-1.5 h-10 px-4 pb-1">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-t-full transition-all duration-300 shadow-sm ${theme.barColor}`}
              style={{
                height: `${h}%`,
                opacity: isPaused ? 0.2 : (isRecording ? 0.75 + level * 0.25 : 0.3),
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
