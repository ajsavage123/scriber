import { describe, it, expect } from "vitest";
import { generateSyntheticPatientId, scrubTextPII } from "../lib/piiScrubber";

describe("DPDP 2023 Statutory Compliance - PII Tokenizer", () => {
  describe("generateSyntheticPatientId()", () => {
    it("generates a synthetic patient ID matching PT-XXXX pattern", () => {
      const id = generateSyntheticPatientId();
      expect(id).toMatch(/^PT-\d{4}$/);
    });

    it("generates unique IDs across calls", () => {
      const id1 = generateSyntheticPatientId();
      const id2 = generateSyntheticPatientId();
      const id3 = generateSyntheticPatientId();
      const set = new Set([id1, id2, id3]);
      expect(set.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("scrubTextPII()", () => {
    it("returns empty string when input is empty", () => {
      expect(scrubTextPII("")).toBe("");
    });

    it("redacts 10-digit Indian mobile numbers without country code", () => {
      const input = "Patient contact is 9876543210 for emergency follow-up.";
      const scrubbed = scrubTextPII(input);
      expect(scrubbed).not.toContain("9876543210");
      expect(scrubbed).toContain("[PHONE REDACTED]");
    });

    it("redacts Indian mobile numbers with +91 country code", () => {
      const input = "Doctor called at +91 9849012345.";
      const scrubbed = scrubTextPII(input);
      expect(scrubbed).not.toContain("9849012345");
      expect(scrubbed).toContain("[PHONE REDACTED]");
    });

    it("redacts email addresses", () => {
      const input = "Send discharge report to patient.kumar@gmail.com immediately.";
      const scrubbed = scrubTextPII(input);
      expect(scrubbed).not.toContain("patient.kumar@gmail.com");
      expect(scrubbed).toContain("[EMAIL REDACTED]");
    });

    it("redacts 12-digit Indian National Identity (Aadhaar) format", () => {
      const input = "Patient ID card verified: 5432 8765 1234.";
      const scrubbed = scrubTextPII(input);
      expect(scrubbed).not.toContain("5432 8765 1234");
      expect(scrubbed).toContain("[ID REDACTED]");
    });

    it("redacts Indian PAN Card alphanumeric numbers", () => {
      const input = "Billing identity verified with PAN ABCDE1234F.";
      const scrubbed = scrubTextPII(input);
      expect(scrubbed).not.toContain("ABCDE1234F");
      expect(scrubbed).toContain("[PAN REDACTED]");
    });

    it("preserves medical terminology, vitals, dosages, and clinical narratives", () => {
      const medicalText = "Patient reports acute migraine, BP 120/80, taking Paracetamol 650mg TID for 3 days.";
      const scrubbed = scrubTextPII(medicalText);
      expect(scrubbed).toBe(medicalText);
    });
  });
});
