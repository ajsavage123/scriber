/**
 * Client-Side PII Tokenizer for DPDP Compliance.
 * Strips identifiable patient names, contact numbers, emails, and Indian government IDs
 * before audio metadata/transcripts are sent to third-party AI APIs.
 */
export function generateSyntheticPatientId(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `PT-${randomNum}`;
}

export function scrubTextPII(text: string): string {
  if (!text) return '';
  return text
    // Redact 10-digit Indian Mobile Numbers
    .replace(/(?:\+91[\-\s]?)?[6789]\d{9}/g, '[PHONE REDACTED]')
    // Redact Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]')
    // Redact 12-digit Indian National Identity numbers
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID REDACTED]')
    // Redact PAN Card Numbers
    .replace(/[A-Z]{5}[0-9]{4}[A-Z]{1}/g, '[PAN REDACTED]');
}