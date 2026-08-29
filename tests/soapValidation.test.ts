import { describe, it, expect } from "vitest";
import { SOAPNote } from "../lib/types";

// Extracted validator function matching app/api/summarize/route.ts
function cleanAndParseJSON(rawInput: any): any {
  if (typeof rawInput === "object" && rawInput !== null) return rawInput;
  if (typeof rawInput !== "string") return null;

  let str = rawInput.trim();
  str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const firstBrace = str.indexOf("{");
  const lastBrace = str.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function validateAndSanitizeSOAP(raw: any): SOAPNote | null {
  if (!raw || typeof raw !== "object") return null;

  const note = raw.soap_note && typeof raw.soap_note === "object" ? raw.soap_note : raw;

  const sanitizeString = (val: any, fallback = "Not documented"): string => {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
    return fallback;
  };

  const sanitizeStringArray = (val: any): string[] => {
    if (Array.isArray(val)) {
      return val
        .map(item => (typeof item === "string" ? item.trim() : String(item || "")))
        .filter(item => item.length > 0);
    }
    if (typeof val === "string" && val.trim().length > 0) {
      return [val.trim()];
    }
    return [];
  };

  const sanitizeMedications = (val: any) => {
    if (!Array.isArray(val)) return [];
    return val
      .filter(item => item && typeof item === "object")
      .map(item => ({
        name: typeof item.name === "string" ? item.name.trim() : "Not specified",
        dosage: typeof item.dosage === "string" ? item.dosage.trim() : "Not specified",
        frequency: typeof item.frequency === "string" ? item.frequency.trim() : "Not specified",
      }))
      .filter(m => m.name !== "Not specified" || m.dosage !== "Not specified");
  };

  const chiefComplaint = sanitizeString(note.chief_complaint, "Clinical Consultation");
  const subjective = sanitizeString(note.subjective, "Patient symptoms documented in consultation.");
  const hpi = sanitizeString(note.history_of_present_illness, subjective);
  const objective = sanitizeString(note.objective, "Not documented in conversation.");
  const assessment = sanitizeString(note.assessment, "Assessment pending clinician sign-off.");
  const followUp = sanitizeString(note.follow_up, "Follow up as clinically indicated.");

  return {
    doctor_speaker_id: sanitizeString(note.doctor_speaker_id, "Speaker 0"),
    patient_speaker_id: sanitizeString(note.patient_speaker_id, "Speaker 1"),
    chief_complaint: chiefComplaint,
    history_of_present_illness: hpi,
    allergies: sanitizeStringArray(note.allergies),
    medications: sanitizeMedications(note.medications),
    subjective: subjective,
    objective: objective,
    assessment: assessment,
    plan: sanitizeStringArray(note.plan).length > 0 ? sanitizeStringArray(note.plan) : ["Review with clinician."],
    follow_up: followUp,
  };
}

describe("SOAP Note JSON Extraction & Clinical Validation", () => {
  describe("cleanAndParseJSON()", () => {
    it("parses valid JSON objects directly", () => {
      const parsed = cleanAndParseJSON({ chief_complaint: "Headache" });
      expect(parsed).toEqual({ chief_complaint: "Headache" });
    });

    it("parses raw JSON strings", () => {
      const raw = '{"chief_complaint": "Acute Fever", "assessment": "Viral Infection"}';
      const parsed = cleanAndParseJSON(raw);
      expect(parsed?.chief_complaint).toBe("Acute Fever");
    });

    it("strips markdown code block fences (```json ... ```)", () => {
      const raw = '```json\n{"chief_complaint": "Tension Headache"}\n```';
      const parsed = cleanAndParseJSON(raw);
      expect(parsed?.chief_complaint).toBe("Tension Headache");
    });

    it("extracts nested JSON when model adds conversational preamble", () => {
      const raw = 'Here is the clinical SOAP note:\n\n{"chief_complaint": "Back Pain"}\n\nHope this helps!';
      const parsed = cleanAndParseJSON(raw);
      expect(parsed?.chief_complaint).toBe("Back Pain");
    });

    it("returns null for malformed or non-JSON input", () => {
      expect(cleanAndParseJSON("Sorry, I cannot process this audio.")).toBeNull();
      expect(cleanAndParseJSON(null)).toBeNull();
      expect(cleanAndParseJSON(undefined)).toBeNull();
    });
  });

  describe("validateAndSanitizeSOAP()", () => {
    it("handles top-level unwrapped SOAP structure", () => {
      const input = {
        doctor_speaker_id: "Speaker 0",
        patient_speaker_id: "Speaker 1",
        chief_complaint: "Throat Pain",
        subjective: "Sore throat for 2 days",
        objective: "Erythema noted in pharynx",
        assessment: "Acute Pharyngitis",
        plan: ["Warm salt water gargles", "Paracetamol 500mg"],
        follow_up: "Return if fever persists >3 days"
      };

      const result = validateAndSanitizeSOAP(input);
      expect(result).not.toBeNull();
      expect(result?.chief_complaint).toBe("Throat Pain");
      expect(result?.plan).toHaveLength(2);
    });

    it("handles top-level soap_note wrapper", () => {
      const input = {
        soap_note: {
          chief_complaint: "Knee Pain",
          assessment: "Mild osteoarthritis"
        }
      };

      const result = validateAndSanitizeSOAP(input);
      expect(result?.chief_complaint).toBe("Knee Pain");
      expect(result?.assessment).toBe("Mild osteoarthritis");
    });

    it("defaults absent vitals/examinations to 'Not documented' instead of fabricating data", () => {
      const input = {
        chief_complaint: "Skin Rash",
        subjective: "Itchy red rash on left arm"
      };

      const result = validateAndSanitizeSOAP(input);
      expect(result?.objective).toBe("Not documented in conversation.");
      expect(result?.allergies).toEqual([]);
      expect(result?.medications).toEqual([]);
    });

    it("sanitizes medication objects properly", () => {
      const input = {
        medications: [
          { name: "Amoxicillin", dosage: "500mg", frequency: "TID x 5 days" },
          { name: "Paracetamol", dosage: "650mg" }
        ]
      };

      const result = validateAndSanitizeSOAP(input);
      expect(result?.medications).toHaveLength(2);
      expect(result?.medications[0].name).toBe("Amoxicillin");
      expect(result?.medications[1].frequency).toBe("Not specified");
    });

    it("returns null for non-object input", () => {
      expect(validateAndSanitizeSOAP(null)).toBeNull();
      expect(validateAndSanitizeSOAP("string")).toBeNull();
    });
  });
});
