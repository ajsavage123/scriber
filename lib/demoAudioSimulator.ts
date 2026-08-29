export type DemoScenario =
  | "full_test"
  | "normal"
  | "quiet_patient"
  | "loud_speaker"
  | "overlap"
  | "silence";

export interface SimulatedAudioState {
  activeSpeaker: "clinician" | "patient" | "both" | "none";
  audioLevel: number; // 0.0 to 1.0
  pitch: number; // Real-time vocal pitch excitation (0.0: deep chest voice to 1.0: high pitch)
  frequencies: number[]; // 8-band frequency energy spectrum [0..1]
  isSpeaking: boolean;
  speakerLabel: string;
  transcriptSnippet?: string;
}

export const DEMO_SCENARIOS: { key: DemoScenario; label: string; description: string }[] = [
  { key: "full_test", label: "Full Audio Test (Default)", description: "Runs complete sequence: normal speech, quiet patient, overlap & silence." },
  { key: "normal", label: "Normal Consultation", description: "Standard clinician and patient conversational dialogue turn-taking." },
  { key: "quiet_patient", label: "Quiet Patient (Low Volume)", description: "Simulates low-volume patient speech (15-25% level) for acoustic testing." },
  { key: "loud_speaker", label: "Loud Speaker", description: "High-amplitude voice intensity (80-95% level)." },
  { key: "overlap", label: "Speaker Overlap", description: "Simultaneous overlap between clinician and patient." },
  { key: "silence", label: "Silence Detection", description: "Calm ambient silence / background noise floor." },
];

export function getSimulatedAudioState(scenario: DemoScenario, seconds: number): SimulatedAudioState {
  // Add sinusoidal voice oscillation for natural intonation physics
  const osc = Math.sin(seconds * 3) * 0.05;
  const pitchOsc = Math.sin(seconds * 4.5) * 0.12;

  switch (scenario) {
    case "quiet_patient": {
      const lvl = Math.max(0.12, Math.min(0.28, 0.20 + osc));
      return {
        activeSpeaker: "patient",
        audioLevel: lvl,
        pitch: Math.max(0.45, Math.min(0.85, 0.65 + pitchOsc)),
        frequencies: [lvl * 0.3, lvl * 0.4, lvl * 0.7, lvl * 0.9, lvl * 0.8, lvl * 0.5, lvl * 0.3, lvl * 0.2],
        isSpeaking: true,
        speakerLabel: "Patient speaking (Quiet / Low Volume)",
        transcriptSnippet: "Patient: I've been feeling slightly dizzy since yesterday morning...",
      };
    }

    case "loud_speaker": {
      const isClinicianLoud = seconds % 6 < 3;
      const lvl = Math.max(0.75, Math.min(0.95, 0.88 + osc));
      const pitch = isClinicianLoud 
        ? Math.max(0.25, Math.min(0.55, 0.40 + pitchOsc)) 
        : Math.max(0.55, Math.min(0.92, 0.75 + pitchOsc));
      return {
        activeSpeaker: isClinicianLoud ? "clinician" : "patient",
        audioLevel: lvl,
        pitch,
        frequencies: [lvl * 0.8, lvl * 0.9, lvl * 1.0, lvl * 0.85, lvl * 0.7, lvl * 0.6, lvl * 0.4, lvl * 0.3],
        isSpeaking: true,
        speakerLabel: isClinicianLoud ? "Clinician speaking (Loud)" : "Patient speaking (Loud)",
        transcriptSnippet: isClinicianLoud 
          ? "Clinician: Please state if the pain radiates down your arm!"
          : "Patient: Yes Doctor! It is very intense right behind my eyes!",
      };
    }

    case "overlap": {
      const lvl = Math.max(0.70, Math.min(0.92, 0.82 + osc));
      return {
        activeSpeaker: "both",
        audioLevel: lvl,
        pitch: 0.58 + Math.sin(seconds * 6) * 0.15,
        frequencies: [lvl * 0.9, lvl * 0.85, lvl * 0.95, lvl * 1.0, lvl * 0.9, lvl * 0.8, lvl * 0.6, lvl * 0.4],
        isSpeaking: true,
        speakerLabel: "Both speaking (Simultaneous Overlap)",
        transcriptSnippet: "Clinician & Patient talking simultaneously...",
      };
    }

    case "silence": {
      const lvl = Math.max(0.01, 0.03 + Math.sin(seconds) * 0.01);
      return {
        activeSpeaker: "none",
        audioLevel: lvl,
        pitch: 0.2,
        frequencies: [lvl, lvl * 0.8, lvl * 0.5, lvl * 0.3, lvl * 0.2, lvl * 0.1, 0, 0],
        isSpeaking: false,
        speakerLabel: "Silence / Background Noise Floor",
        transcriptSnippet: "[Pause / Ambient Silence]",
      };
    }

    case "normal": {
      const cycle = seconds % 10;
      if (cycle < 5) {
        const lvl = Math.max(0.45, Math.min(0.75, 0.62 + osc));
        return {
          activeSpeaker: "clinician",
          audioLevel: lvl,
          pitch: Math.max(0.28, Math.min(0.52, 0.38 + pitchOsc)),
          frequencies: [lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3, lvl * 0.2, lvl * 0.1],
          isSpeaking: true,
          speakerLabel: "Clinician speaking",
          transcriptSnippet: "Clinician: How long have you experienced these symptoms?",
        };
      } else {
        const lvl = Math.max(0.45, Math.min(0.72, 0.58 + osc));
        return {
          activeSpeaker: "patient",
          audioLevel: lvl,
          pitch: Math.max(0.55, Math.min(0.88, 0.72 + pitchOsc)),
          frequencies: [lvl * 0.4, lvl * 0.6, lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3],
          isSpeaking: true,
          speakerLabel: "Patient speaking",
          transcriptSnippet: "Patient: For about 3 days, Doctor. It gets worse near light.",
        };
      }
    }

    case "full_test":
    default: {
      // Full Timeline Sequence (35s total loop)
      const t = seconds % 35;

      if (t >= 0 && t < 4) {
        const lvl = Math.max(0.45, Math.min(0.75, 0.65 + osc));
        return {
          activeSpeaker: "clinician",
          audioLevel: lvl,
          pitch: Math.max(0.28, Math.min(0.52, 0.38 + pitchOsc)),
          frequencies: [lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3, lvl * 0.2, lvl * 0.1],
          isSpeaking: true,
          speakerLabel: "Clinician speaking",
          transcriptSnippet: "Clinician: Good morning! What brings you into the clinic today?",
        };
      } else if (t >= 4 && t < 9) {
        const lvl = Math.max(0.45, Math.min(0.72, 0.58 + osc));
        return {
          activeSpeaker: "patient",
          audioLevel: lvl,
          pitch: Math.max(0.55, Math.min(0.88, 0.72 + pitchOsc)),
          frequencies: [lvl * 0.4, lvl * 0.6, lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3],
          isSpeaking: true,
          speakerLabel: "Patient speaking",
          transcriptSnippet: "Patient: Hello Doctor, I've had a severe headache for 3 days and fever.",
        };
      } else if (t >= 9 && t < 12) {
        const lvl = Math.max(0.45, Math.min(0.78, 0.70 + osc));
        return {
          activeSpeaker: "clinician",
          audioLevel: lvl,
          pitch: Math.max(0.28, Math.min(0.55, 0.42 + pitchOsc)),
          frequencies: [lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3, lvl * 0.2, lvl * 0.1],
          isSpeaking: true,
          speakerLabel: "Clinician speaking",
          transcriptSnippet: "Clinician: On a scale of 1 to 10, how severe would you rate the pain?",
        };
      } else if (t >= 12 && t < 17) {
        // LOW-VOLUME PATIENT SPEECH SEGMENT (12s to 17s)
        const lvl = Math.max(0.12, Math.min(0.28, 0.20 + osc));
        return {
          activeSpeaker: "patient",
          audioLevel: lvl,
          pitch: Math.max(0.50, Math.min(0.80, 0.65 + pitchOsc)),
          frequencies: [lvl * 0.3, lvl * 0.5, lvl * 0.8, lvl * 0.9, lvl * 0.7, lvl * 0.5, lvl * 0.3, lvl * 0.2],
          isSpeaking: true,
          speakerLabel: "Patient speaking (Quiet / Low Volume)",
          transcriptSnippet: "Patient: It is around 7 or 8... bright light really bothers my eyes...",
        };
      } else if (t >= 17 && t < 20) {
        // SILENCE SEGMENT
        const lvl = Math.max(0.01, 0.02 + Math.sin(t) * 0.01);
        return {
          activeSpeaker: "none",
          audioLevel: lvl,
          pitch: 0.2,
          frequencies: [lvl, lvl * 0.8, lvl * 0.5, lvl * 0.3, lvl * 0.2, lvl * 0.1, 0, 0],
          isSpeaking: false,
          speakerLabel: "Silence",
          transcriptSnippet: "[Ambient Silence / Doctor examining patient]",
        };
      } else if (t >= 20 && t < 24) {
        const lvl = Math.max(0.45, Math.min(0.75, 0.62 + osc));
        return {
          activeSpeaker: "clinician",
          audioLevel: lvl,
          pitch: Math.max(0.28, Math.min(0.52, 0.38 + pitchOsc)),
          frequencies: [lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3, lvl * 0.2, lvl * 0.1],
          isSpeaking: true,
          speakerLabel: "Clinician speaking",
          transcriptSnippet: "Clinician: I see. Are you experiencing any neck stiffness or nausea?",
        };
      } else if (t >= 24 && t < 28) {
        const lvl = Math.max(0.45, Math.min(0.70, 0.60 + osc));
        return {
          activeSpeaker: "patient",
          audioLevel: lvl,
          pitch: Math.max(0.55, Math.min(0.88, 0.70 + pitchOsc)),
          frequencies: [lvl * 0.4, lvl * 0.6, lvl * 0.85, lvl * 0.95, lvl * 0.8, lvl * 0.6, lvl * 0.4, lvl * 0.3],
          isSpeaking: true,
          speakerLabel: "Patient speaking",
          transcriptSnippet: "Patient: Yes, my neck feels a bit stiff and I tried taking Tylenol.",
        };
      } else if (t >= 28 && t < 31) {
        // OVERLAP SEGMENT
        const lvl = Math.max(0.70, Math.min(0.92, 0.85 + osc));
        return {
          activeSpeaker: "both",
          audioLevel: lvl,
          pitch: 0.58 + Math.sin(seconds * 6) * 0.15,
          frequencies: [lvl * 0.9, lvl * 0.85, lvl * 0.95, lvl * 1.0, lvl * 0.9, lvl * 0.8, lvl * 0.6, lvl * 0.4],
          isSpeaking: true,
          speakerLabel: "Both speaking (Overlap)",
          transcriptSnippet: "Clinician & Patient talking simultaneously...",
        };
      } else {
        // SILENCE / END LOOP
        const lvl = Math.max(0.01, 0.02 + Math.sin(t) * 0.01);
        return {
          activeSpeaker: "none",
          audioLevel: lvl,
          pitch: 0.2,
          frequencies: [lvl, lvl * 0.8, lvl * 0.5, lvl * 0.3, lvl * 0.2, lvl * 0.1, 0, 0],
          isSpeaking: false,
          speakerLabel: "Silence",
          transcriptSnippet: "[Silence / Preparing consultation record]",
        };
      }
    }
  }
}
