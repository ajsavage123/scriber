"use client";

import React, { useEffect, useRef } from "react";
import { ActiveSpeaker } from "./SpeakerAmbientVisualizer";

interface SiriWaveformVisualizerProps {
  activeSpeaker?: ActiveSpeaker;
  audioLevel?: number; // 0.0 to 1.0
  pitch?: number; // 0.0 to 1.0 real-time vocal pitch
  frequencies?: number[];
  isRecording?: boolean;
  isPaused?: boolean;
  className?: string;
}

export default function SiriWaveformVisualizer({
  activeSpeaker = "none",
  audioLevel = 0,
  pitch = 0.4,
  frequencies = [],
  isRecording = false,
  isPaused = false,
  className = "",
}: SiriWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Smooth interpolation refs for organic physics
  const currentAmpRef = useRef(0.08);
  const targetAmpRef = useRef(0.08);
  const phaseRef = useRef(0);
  const pitchRef = useRef(0.4);
  const animationFrameId = useRef<number>(0);

  // Speaker palette weights (smooth interpolation between Clinician & Patient)
  const clinicianWeightRef = useRef(0.5);
  const patientWeightRef = useRef(0.5);
  const activeSpeakerRef = useRef(activeSpeaker);

  useEffect(() => {
    activeSpeakerRef.current = activeSpeaker;
  }, [activeSpeaker]);

  // Update target amplitude based on recording & audio level
  useEffect(() => {
    if (isPaused) {
      targetAmpRef.current = 0.005;
    } else if (isRecording) {
      // Scale level smoothly between a gentle idle wave and full voice response
      targetAmpRef.current = Math.max(0.15, Math.min(1.0, audioLevel * 1.3 + 0.12));
    } else {
      targetAmpRef.current = 0.06; // subtle idle breathing
    }
  }, [audioLevel, isRecording, isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1));
    let height = (canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = Math.max(1, canvas.offsetWidth * (window.devicePixelRatio || 1));
      height = canvas.height = Math.max(1, canvas.offsetHeight * (window.devicePixelRatio || 1));
    };

    window.addEventListener("resize", handleResize);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(canvas);
    }

    const render = () => {
      // Physics interpolation for smooth amplitude damping (lerp)
      const lerpSpeed = isPaused ? 0.2 : 0.14;
      currentAmpRef.current += (targetAmpRef.current - currentAmpRef.current) * lerpSpeed;
      
      // Interpolate pitch smoothly
      pitchRef.current += (pitch - pitchRef.current) * 0.15;

      const speedScale = isPaused ? 0 : isRecording ? (1.0 + currentAmpRef.current * 1.4 + pitchRef.current * 0.6) : 0.6;
      phaseRef.current += 0.032 * speedScale;

      // Smoothly interpolate speaker color weights
      const targetClinician = activeSpeakerRef.current === "clinician" ? 1.0 : activeSpeakerRef.current === "both" ? 0.6 : activeSpeakerRef.current === "patient" ? 0.0 : 0.5;
      const targetPatient = activeSpeakerRef.current === "patient" ? 1.0 : activeSpeakerRef.current === "both" ? 0.6 : activeSpeakerRef.current === "clinician" ? 0.0 : 0.5;
      
      clinicianWeightRef.current += (targetClinician - clinicianWeightRef.current) * 0.1;
      patientWeightRef.current += (targetPatient - patientWeightRef.current) * 0.1;

      const dpr = window.devicePixelRatio || 1;
      const w = width / dpr;
      const h = height / dpr;
      const centerY = h / 2;

      // Compact & Elegant Wave Height (Keeps wave in the middle zone, never overlapping header or timer)
      const compressedAmp = Math.tanh(currentAmpRef.current * 1.4);
      const maxWaveHeight = isPaused 
        ? 2 
        : isRecording 
        ? Math.min(52, Math.max(8, (h * 0.09) * (0.35 + compressedAmp * 0.65)))
        : Math.min(16, (h * 0.035) + 6);

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep Black Canvas Background
      ctx.fillStyle = "#040711";
      ctx.fillRect(0, 0, w, h);

      // Dynamic Radial Ambient Glow based on Clinician (Emerald/Cyan) vs Patient (Pink/Magenta)
      if (isRecording && !isPaused) {
        const radGrad = ctx.createRadialGradient(w / 2, centerY, 5, w / 2, centerY, Math.min(w * 0.45, 260));
        
        if (clinicianWeightRef.current > 0.6) {
          // Clinician Speaking: Emerald & Cyan glow
          radGrad.addColorStop(0, `rgba(16, 185, 129, ${0.22 * clinicianWeightRef.current})`);
          radGrad.addColorStop(0.4, `rgba(6, 214, 250, ${0.16 * clinicianWeightRef.current})`);
          radGrad.addColorStop(1, "rgba(4, 7, 17, 0)");
        } else if (patientWeightRef.current > 0.6) {
          // Patient Speaking: Pink & Magenta glow
          radGrad.addColorStop(0, `rgba(236, 72, 153, ${0.22 * patientWeightRef.current})`);
          radGrad.addColorStop(0.4, `rgba(168, 85, 247, ${0.16 * patientWeightRef.current})`);
          radGrad.addColorStop(1, "rgba(4, 7, 17, 0)");
        } else {
          // Balanced Spectrum (Both or Ambient)
          radGrad.addColorStop(0, "rgba(6, 214, 250, 0.14)");
          radGrad.addColorStop(0.4, "rgba(236, 72, 153, 0.12)");
          radGrad.addColorStop(1, "rgba(4, 7, 17, 0)");
        }
        
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // Additive Blending for realistic Apple neon bloom effect
      ctx.globalCompositeOperation = "screen";

      // Dynamically map Clinician & Patient energy weights (0 to 1)
      const cW = clinicianWeightRef.current;
      const pW = patientWeightRef.current;
      
      // Calculate opacity & amplitude boosts for speaker-specific Siri colors
      const cBoost = 1.0 + (cW * 0.8) - (pW * 0.4);
      const pBoost = 1.0 + (pW * 0.8) - (cW * 0.4);

      // Pure Apple Siri Multi-Harmonic Spectrum (Fixed 5-harmonic Neon Palette)
      // Clinician dominates Cyan, Teal, and Cobalt Blue
      // Patient dominates Neon Magenta and Electric Violet
      const waveLayers = [
        // 1. Electric Cyan Ribbon (Outer upper harmonic) -> Clinician
        {
          freq: 2.2,
          speed: 0.042,
          phaseOffset: 0,
          ampMultiplier: 1.0 * cBoost,
          strokeColor: `rgba(6, 214, 250, ${Math.min(1.0, 0.75 + cW * 0.25)})`,
          fillColorTop: `rgba(6, 214, 250, ${0.12 + cW * 0.15})`,
          fillColorBottom: "rgba(0, 0, 0, 0)",
          glow: "#00f0ff",
          lineWidth: 2.4,
        },
        // 2. Neon Magenta / Pink Ribbon (Mid dynamic harmonic) -> Patient
        {
          freq: 2.8,
          speed: 0.036,
          phaseOffset: Math.PI * 0.45,
          ampMultiplier: 0.85 * pBoost,
          strokeColor: `rgba(255, 42, 133, ${Math.min(1.0, 0.75 + pW * 0.25)})`,
          fillColorTop: `rgba(255, 42, 133, ${0.12 + pW * 0.15})`,
          fillColorBottom: "rgba(0, 0, 0, 0)",
          glow: "#ff2a85",
          lineWidth: 2.2,
        },
        // 3. Vibrant Purple / Violet Ribbon (Center harmonic) -> Patient
        {
          freq: 3.4,
          speed: 0.05,
          phaseOffset: Math.PI * 0.9,
          ampMultiplier: 0.72 * pBoost,
          strokeColor: `rgba(168, 85, 247, ${Math.min(1.0, 0.75 + pW * 0.25)})`,
          fillColorTop: `rgba(168, 85, 247, ${0.10 + pW * 0.12})`,
          fillColorBottom: "rgba(0, 0, 0, 0)",
          glow: "#a855f7",
          lineWidth: 2.0,
        },
        // 4. Bright Teal / Aqua Ribbon (Interleaved harmonic) -> Clinician
        {
          freq: 1.9,
          speed: 0.03,
          phaseOffset: Math.PI * 1.35,
          ampMultiplier: 0.88 * cBoost,
          strokeColor: `rgba(0, 245, 160, ${Math.min(1.0, 0.75 + cW * 0.25)})`,
          fillColorTop: `rgba(0, 245, 160, ${0.10 + cW * 0.12})`,
          fillColorBottom: "rgba(0, 0, 0, 0)",
          glow: "#00f5a0",
          lineWidth: 2.0,
        },
        // 5. Deep Royal / Cobalt Blue Ribbon (Lower resonance) -> Clinician
        {
          freq: 4.1,
          speed: 0.058,
          phaseOffset: Math.PI * 1.8,
          ampMultiplier: 0.62 * cBoost,
          strokeColor: `rgba(67, 97, 238, ${Math.min(1.0, 0.75 + cW * 0.25)})`,
          fillColorTop: `rgba(67, 97, 238, ${0.08 + cW * 0.1})`,
          fillColorBottom: "rgba(0, 0, 0, 0)",
          glow: "#4361ee",
          lineWidth: 1.8,
        },
      ];

      // Resolution steps for continuous curve paths (smooth at all screen DPIs)
      const step = 2;
      const pointsCount = Math.ceil(w / step) + 1;

      // Render each continuous liquid Siri wave ribbon
      for (const layer of waveLayers) {
        ctx.shadowColor = layer.glow;
        ctx.shadowBlur = isRecording && !isPaused ? 14 : 5;
        ctx.lineWidth = layer.lineWidth;

        // 1. Draw top & bottom filled ribbon polygon
        ctx.beginPath();
        const topPoints: { x: number; y: number }[] = [];
        const bottomPoints: { x: number; y: number }[] = [];

        // Dynamic pitch modulation factor: high pitch creates tighter, faster ripples; deep voice creates wide, rolling swells
        const pMod = 0.75 + pitchRef.current * 0.7;
        const dynFreq = layer.freq * pMod;
        const dynSpeed = layer.speed * (0.8 + pitchRef.current * 0.5);

        for (let i = 0; i <= pointsCount; i++) {
          const x = Math.min(w, i * step);
          const normX = x / w; // 0 to 1

          // Envelope window: Raised Sine bell curve that tapers cleanly to 0 at edges
          const envelope = Math.pow(Math.sin(normX * Math.PI), 2.2);

          // Multi-harmonic modulation dynamically reacting to vocal pitch & timbre
          const sin1 = Math.sin(normX * Math.PI * 2 * dynFreq + phaseRef.current * (dynSpeed / 0.035) + layer.phaseOffset);
          const sin2 = Math.sin(normX * Math.PI * 4 * dynFreq - phaseRef.current * 0.75 + layer.phaseOffset) * (0.28 + pitchRef.current * 0.22);
          const sin3 = Math.cos(normX * Math.PI * (1.6 + pitchRef.current * 1.8) + phaseRef.current * 0.4) * 0.16;
          const combinedWave = (sin1 + sin2 + sin3) * envelope;

          const waveAmp = isPaused ? 1 : Math.max(1.5, Math.abs(combinedWave) * maxWaveHeight * layer.ampMultiplier);

          topPoints.push({ x, y: centerY - waveAmp });
          bottomPoints.push({ x, y: centerY + waveAmp });
        }

        // Build continuous closed ribbon path
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i++) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        for (let i = bottomPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
        }
        ctx.closePath();

        // Fill ribbon with soft glow gradient
        const ribGrad = ctx.createLinearGradient(0, centerY - maxWaveHeight, 0, centerY + maxWaveHeight);
        ribGrad.addColorStop(0, layer.fillColorTop);
        ribGrad.addColorStop(0.5, layer.fillColorTop);
        ribGrad.addColorStop(1, layer.fillColorBottom);
        ctx.fillStyle = ribGrad;
        ctx.fill();

        // 2. Stroke upper & lower neon crest lines
        ctx.strokeStyle = layer.strokeColor;
        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i++) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
        for (let i = 1; i < bottomPoints.length; i++) {
          ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
        }
        ctx.stroke();
      }

      // Center bright white-hot laser core line (Apple Siri trademark center streak)
      ctx.beginPath();
      ctx.strokeStyle = isPaused ? "rgba(245, 158, 11, 0.75)" : "rgba(255, 255, 255, 0.98)";
      ctx.shadowColor = isPaused ? "#f59e0b" : "#ffffff";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8;
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();

      ctx.restore();

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [isRecording, isPaused]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-default"
      />
    </div>
  );
}
