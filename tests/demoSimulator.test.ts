import { describe, it, expect } from "vitest";
import { getSimulatedAudioState, DEMO_SCENARIOS } from "../lib/demoAudioSimulator";

describe("Audio Simulation & Turn-Taking Logic", () => {
  it("provides valid configurations for all demo scenarios", () => {
    expect(DEMO_SCENARIOS.find(s => s.key === "full_test")).toBeDefined();
    expect(DEMO_SCENARIOS.find(s => s.key === "normal")).toBeDefined();
    expect(DEMO_SCENARIOS.find(s => s.key === "silence")).toBeDefined();
    expect(DEMO_SCENARIOS.find(s => s.key === "quiet_patient")).toBeDefined();
    expect(DEMO_SCENARIOS.find(s => s.key === "loud_speaker")).toBeDefined();
    expect(DEMO_SCENARIOS.find(s => s.key === "overlap")).toBeDefined();
  });

  describe("getSimulatedAudioState()", () => {
    it("returns silent state for silence scenario", () => {
      const stateAt0 = getSimulatedAudioState("silence", 0);
      const stateAt10 = getSimulatedAudioState("silence", 10);
      
      expect(stateAt0.activeSpeaker).toBe("none");
      expect(stateAt0.isSpeaking).toBe(false);
      expect(stateAt10.activeSpeaker).toBe("none");
      expect(stateAt10.isSpeaking).toBe(false);
    });

    it("simulates clinician speaking at start of full_test scenario", () => {
      const state = getSimulatedAudioState("full_test", 2);
      expect(state.activeSpeaker).toBe("clinician");
      expect(state.audioLevel).toBeGreaterThan(0.4);
    });

    it("alternates speaker turn to patient during full_test conversation", () => {
      // In full_test: t >= 4 && t < 9 is Patient speaking
      const patientState = getSimulatedAudioState("full_test", 6);
      expect(patientState.activeSpeaker).toBe("patient");
      expect(patientState.audioLevel).toBeGreaterThan(0.4);
    });

    it("simulates quiet low-volume patient speech (12s to 17s)", () => {
      const quietState = getSimulatedAudioState("full_test", 14);
      expect(quietState.activeSpeaker).toBe("patient");
      expect(quietState.audioLevel).toBeLessThan(0.35);
    });

    it("detects silence intervals in full_test (17s to 20s)", () => {
      const silenceState = getSimulatedAudioState("full_test", 18);
      expect(silenceState.activeSpeaker).toBe("none");
      expect(silenceState.isSpeaking).toBe(false);
      expect(silenceState.audioLevel).toBeLessThan(0.05);
    });

    it("simulates simultaneous overlap (28s to 31s)", () => {
      const overlapState = getSimulatedAudioState("full_test", 29);
      expect(overlapState.activeSpeaker).toBe("both");
      expect(overlapState.isSpeaking).toBe(true);
      expect(overlapState.audioLevel).toBeGreaterThan(0.7);
    });
  });
});
