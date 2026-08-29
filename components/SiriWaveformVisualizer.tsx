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
  const lastFrameTimeRef = useRef(0);

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
      targetAmpRef.current = Math.max(0.15, Math.min(1.0, audioLevel * 1.3 + 0.12));
    } else {
      targetAmpRef.current = 0.06; // subtle idle breathing
    }
  }, [audioLevel, isRecording, isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false }); // alpha: false gives major GPU raster performance boost
    if (!ctx) return;

    // Cap DPR at 2 on mobile to prevent memory bandwidth starvation on 3x screens
    const getDPR = () => Math.min(window.devicePixelRatio || 1, 2);

    let dpr = getDPR();
    let width = (canvas.width = canvas.offsetWidth * dpr);
    let height = (canvas.height = canvas.offsetHeight * dpr);

    const handleResize = () => {
      if (!canvas) return;
      dpr = getDPR();
      width = canvas.width = Math.max(1, canvas.offsetWidth * dpr);
      height = canvas.height = Math.max(1, canvas.offsetHeight * dpr);
    };

    window.addEventListener("resize", handleResize);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(canvas);
    }

    const render = (time: number) => {
      // Limit to ~60 FPS max to eliminate thermal throttling and lag on 120Hz mobile screens
      if (time - lastFrameTimeRef.current < 15) {
        animationFrameId.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTimeRef.current = time;

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

      const w = width / dpr;
      const h = height / dpr;
      const centerY = h / 2;

      // Compact & Elegant Wave Height
      const compressedAmp = Math.tanh(currentAmpRef.current * 1.4);
      const maxWaveHeight = isPaused 
        ? 2 
        : isRecording 
        ? Math.min(48, Math.max(8, (h * 0.09) * (0.35 + compressedAmp * 0.65)))
        : Math.min(15, (h * 0.035) + 6);

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep Black Canvas Background
      ctx.fillStyle = "#040711";
      ctx.fillRect(0, 0, w, h);

      // Fast Dynamic Ambient Radial Glow
      if (isRecording && !isPaused) {
        const radGrad = ctx.createRadialGradient(w / 2, centerY, 5, w / 2, centerY, Math.min(w * 0.4, 220));
        if (clinicianWeightRef.current > 0.6) {
          radGrad.addColorStop(0, `rgba(16, 185, 129, ${0.18 * clinicianWeightRef.current})`);
          radGrad.addColorStop(0.5, `rgba(6, 214, 250, ${0.12 * clinicianWeightRef.current})`);
        } else if (patientWeightRef.current > 0.6) {
          radGrad.addColorStop(0, `rgba(236, 72, 153, ${0.18 * patientWeightRef.current})`);
          radGrad.addColorStop(0.5, `rgba(168, 85, 247, ${0.12 * patientWeightRef.current})`);
        } else {
          radGrad.addColorStop(0, "rgba(6, 214, 250, 0.12)");
          radGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.10)");
        }
        radGrad.addColorStop(1, "rgba(4, 7, 17, 0)");
        
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // Additive Screen Blending for Hardware GPU Neon Bloom (zero CPU blur overhead)
      ctx.globalCompositeOperation = "screen";

      const cW = clinicianWeightRef.current;
      const pW = patientWeightRef.current;
      
      const cBoost = 1.0 + (cW * 0.7) - (pW * 0.35);
      const pBoost = 1.0 + (pW * 0.7) - (cW * 0.35);

      // Pure Apple Siri Multi-Harmonic Spectrum
      const waveLayers = [
        // 1. Electric Cyan Ribbon -> Clinician
        {
          freq: 2.2,
          speed: 0.042,
          phaseOffset: 0,
          ampMultiplier: 1.0 * cBoost,
          strokeColor: `rgba(6, 214, 250, ${Math.min(1.0, 0.8 + cW * 0.2)})`,
          fillColorTop: `rgba(6, 214, 250, ${0.12 + cW * 0.14})`,
          lineWidth: 2.4,
        },
        // 2. Neon Magenta Ribbon -> Patient
        {
          freq: 2.8,
          speed: 0.036,
          phaseOffset: Math.PI * 0.45,
          ampMultiplier: 0.85 * pBoost,
          strokeColor: `rgba(255, 42, 133, ${Math.min(1.0, 0.8 + pW * 0.2)})`,
          fillColorTop: `rgba(255, 42, 133, ${0.12 + pW * 0.14})`,
          lineWidth: 2.2,
        },
        // 3. Vibrant Violet Ribbon -> Patient
        {
          freq: 3.4,
          speed: 0.05,
          phaseOffset: Math.PI * 0.9,
          ampMultiplier: 0.72 * pBoost,
          strokeColor: `rgba(168, 85, 247, ${Math.min(1.0, 0.8 + pW * 0.2)})`,
          fillColorTop: `rgba(168, 85, 247, ${0.10 + pW * 0.12})`,
          lineWidth: 2.0,
        },
        // 4. Bright Teal Ribbon -> Clinician
        {
          freq: 1.9,
          speed: 0.03,
          phaseOffset: Math.PI * 1.35,
          ampMultiplier: 0.88 * cBoost,
          strokeColor: `rgba(0, 245, 160, ${Math.min(1.0, 0.8 + cW * 0.2)})`,
          fillColorTop: `rgba(0, 245, 160, ${0.10 + cW * 0.12})`,
          lineWidth: 2.0,
        },
        // 5. Deep Cobalt Blue Ribbon -> Clinician
        {
          freq: 4.1,
          speed: 0.058,
          phaseOffset: Math.PI * 1.8,
          ampMultiplier: 0.62 * cBoost,
          strokeColor: `rgba(67, 97, 238, ${Math.min(1.0, 0.8 + cW * 0.2)})`,
          fillColorTop: `rgba(67, 97, 238, ${0.08 + cW * 0.1})`,
          lineWidth: 1.8,
        },
      ];

      // Highly optimized step size (step = 6 gives identical smooth curve at 4x less CPU cost)
      const step = 6;
      const pointsCount = Math.ceil(w / step) + 1;

      // Pitch dynamic factors
      const pMod = 0.75 + pitchRef.current * 0.7;
      const dynSpeedBase = 0.8 + pitchRef.current * 0.5;

      for (const layer of waveLayers) {
        ctx.lineWidth = layer.lineWidth;

        // 1. Draw top & bottom filled ribbon polygon
        ctx.beginPath();
        const topPoints: { x: number; y: number }[] = [];
        const bottomPoints: { x: number; y: number }[] = [];

        const dynFreq = layer.freq * pMod;
        const dynSpeed = layer.speed * dynSpeedBase;
        const phaseShift = phaseRef.current * (dynSpeed / 0.035) + layer.phaseOffset;

        for (let i = 0; i <= pointsCount; i++) {
          const x = Math.min(w, i * step);
          const normX = x / w; // 0 to 1

          // Envelope window
          const envelope = Math.pow(Math.sin(normX * Math.PI), 2.2);

          // Fast 2-harmonic formula (much lighter on mobile CPU)
          const sin1 = Math.sin(normX * Math.PI * 2 * dynFreq + phaseShift);
          const sin2 = Math.sin(normX * Math.PI * 4 * dynFreq - phaseRef.current * 0.75 + layer.phaseOffset) * 0.35;
          const combinedWave = (sin1 + sin2) * envelope;

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

        // Fill ribbon
        ctx.fillStyle = layer.fillColorTop;
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

      // Center bright white laser core streak
      ctx.beginPath();
      ctx.strokeStyle = isPaused ? "rgba(245, 158, 11, 0.85)" : "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1.6;
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
    <div className={`relative w-full h-full overflow-hidden will-change-transform transform-gpu ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-default transform-gpu"
      />
    </div>
  );
}

