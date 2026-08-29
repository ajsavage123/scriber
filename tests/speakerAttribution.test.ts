import { describe, it, expect } from "vitest";
import { validateAndSanitizeSOAP } from "../lib/soapSanitizer";

describe("Robust Speaker Role Mapping & Validation Tests", () => {
  const dummyTranscript = "Speaker 0: Hello patient.\nSpeaker 1: Hello doctor, my leg hurts.";

  it("assigns correct speaker roles and sets needs_review = false for normal 2-speaker encounters with high confidence", () => {
    const rawNote = {
      doctor_speaker_id: "Speaker 0",
      patient_speaker_id: "Speaker 1",
      speaker_roles: {
        "Speaker 0": { role: "doctor", confidence: 0.95 },
        "Speaker 1": { role: "patient", confidence: 0.90 }
      },
      chief_complaint: "Leg pain"
    };

    const sanitized = validateAndSanitizeSOAP(rawNote, dummyTranscript);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.speaker_roles).toEqual({
      "Speaker 0": { role: "doctor", confidence: 0.95 },
      "Speaker 1": { role: "patient", confidence: 0.90 }
    });
    expect(sanitized!.needs_review).toBe(false);
  });

  it("sets needs_review = true if any confidence score is below 0.60", () => {
    const rawNote = {
      doctor_speaker_id: "Speaker 0",
      patient_speaker_id: "Speaker 1",
      speaker_roles: {
        "Speaker 0": { role: "doctor", confidence: 0.55 },
        "Speaker 1": { role: "patient", confidence: 0.90 }
      },
      chief_complaint: "Leg pain"
    };

    const sanitized = validateAndSanitizeSOAP(rawNote, dummyTranscript);
    expect(sanitized!.needs_review).toBe(true);
  });

  it("sets needs_review = true if any speaker is mapped as unknown role", () => {
    const rawNote = {
      doctor_speaker_id: "Speaker 0",
      patient_speaker_id: "Speaker 1",
      speaker_roles: {
        "Speaker 0": { role: "doctor", confidence: 0.90 },
        "Speaker 1": { role: "unknown", confidence: 0.90 }
      },
      chief_complaint: "Leg pain"
    };

    const sanitized = validateAndSanitizeSOAP(rawNote, dummyTranscript);
    expect(sanitized!.needs_review).toBe(true);
  });

  it("injects missing speakers from raw transcript with unknown role & confidence 0, and flags for review", () => {
    const threeSpeakerTranscript = "Speaker 0: Hello.\nSpeaker 1: Hi.\nSpeaker 2: I am the caregiver.";
    const rawNote = {
      doctor_speaker_id: "Speaker 0",
      patient_speaker_id: "Speaker 1",
      speaker_roles: {
        "Speaker 0": { role: "doctor", confidence: 0.90 },
        "Speaker 1": { role: "patient", confidence: 0.90 }
        // Speaker 2 is missing from Llama output
      },
      chief_complaint: "Checkup"
    };

    const sanitized = validateAndSanitizeSOAP(rawNote, threeSpeakerTranscript);
    expect(sanitized!.speaker_roles).toEqual({
      "Speaker 0": { role: "doctor", confidence: 0.90 },
      "Speaker 1": { role: "patient", confidence: 0.90 },
      "Speaker 2": { role: "unknown", confidence: 0 }
    });
    expect(sanitized!.needs_review).toBe(true);
  });

  it("ignores hallucinated speaker IDs returned by LLM that were not in Deepgram transcript", () => {
    const rawNote = {
      doctor_speaker_id: "Speaker 0",
      patient_speaker_id: "Speaker 1",
      speaker_roles: {
        "Speaker 0": { role: "doctor", confidence: 0.90 },
        "Speaker 1": { role: "patient", confidence: 0.90 },
        "Speaker 9": { role: "caregiver", confidence: 0.90 } // Hallucinated Speaker 9
      },
      chief_complaint: "Checkup"
    };

    const sanitized = validateAndSanitizeSOAP(rawNote, dummyTranscript);
    expect(sanitized!.speaker_roles).toEqual({
      "Speaker 0": { role: "doctor", confidence: 0.90 },
      "Speaker 1": { role: "patient", confidence: 0.90 }
    });
    expect(sanitized!.speaker_roles!["Speaker 9"]).toBeUndefined();
  });

  it("overrides mapped roles and updates doctor/patient speaker IDs when manual corrections are passed", () => {
    const rawNote = {
      doctor_speaker_id: "Speaker 0",
      patient_speaker_id: "Speaker 1",
      speaker_roles: {
        "Speaker 0": { role: "doctor", confidence: 0.95 },
        "Speaker 1": { role: "patient", confidence: 0.90 }
      },
      chief_complaint: "Checkup"
    };

    const manualCorrection = {
      "Speaker 0": { role: "patient", confidence: 1.0 },
      "Speaker 1": { role: "doctor", confidence: 1.0 }
    };

    const sanitized = validateAndSanitizeSOAP(rawNote, dummyTranscript, manualCorrection);
    expect(sanitized!.speaker_roles).toEqual({
      "Speaker 0": { role: "patient", confidence: 1.0 },
      "Speaker 1": { role: "doctor", confidence: 1.0 }
    });
    expect(sanitized!.doctor_speaker_id).toBe("Speaker 1");
    expect(sanitized!.patient_speaker_id).toBe("Speaker 0");
  });
});
