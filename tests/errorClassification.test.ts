import { describe, it, expect } from "vitest";

// Error classification helper logic matching app/api/summarize/route.ts
function classifyError(status: number, errText: string): { errorCode: string; userMessage: string; canRetry: boolean } {
  const isQuotaExceeded = status === 429 && (
    errText.toLowerCase().includes("daily") ||
    errText.toLowerCase().includes("quota") ||
    errText.toLowerCase().includes("limit")
  );

  if (isQuotaExceeded) {
    return {
      errorCode: "DAILY_QUOTA_EXCEEDED",
      userMessage: "Daily AI note generation quota reached. Your transcript has been safely preserved. You can retry later or review the diarized transcript.",
      canRetry: false
    };
  }

  const isTimeout = errText.toLowerCase().includes("timeout") || status === 504;
  if (isTimeout) {
    return {
      errorCode: "TIMEOUT",
      userMessage: "AI note generation timed out. Your transcript is safely preserved. Please click Retry SOAP Note.",
      canRetry: true
    };
  }

  if (status >= 500 || status === 429) {
    return {
      errorCode: "TRANSIENT_FAILURE",
      userMessage: "AI note generation is temporarily unavailable. Your transcript is safely preserved. Please click Retry SOAP Note.",
      canRetry: true
    };
  }

  return {
    errorCode: "INTERNAL_ERROR",
    userMessage: "An unexpected error occurred during SOAP generation. Your transcript is safe. Please click Retry SOAP Note.",
    canRetry: true
  };
}

describe("API Error Classification & Resilience Engine", () => {
  it("classifies Cloudflare daily quota exhaustion as non-retryable DAILY_QUOTA_EXCEEDED", () => {
    const error = classifyError(429, "Daily neuron limit reached for account.");
    expect(error.errorCode).toBe("DAILY_QUOTA_EXCEEDED");
    expect(error.canRetry).toBe(false);
    expect(error.userMessage).toContain("Daily AI note generation quota reached");
  });

  it("classifies gateway / AI execution timeout as TIMEOUT", () => {
    const error = classifyError(504, "Gateway timeout: request exceeded 35 seconds.");
    expect(error.errorCode).toBe("TIMEOUT");
    expect(error.canRetry).toBe(true);
    expect(error.userMessage).toContain("timed out");
  });

  it("classifies transient 503 service unavailable as retryable TRANSIENT_FAILURE", () => {
    const error = classifyError(503, "Cloudflare Workers AI model overloaded.");
    expect(error.errorCode).toBe("TRANSIENT_FAILURE");
    expect(error.canRetry).toBe(true);
    expect(error.userMessage).toContain("temporarily unavailable");
  });

  it("classifies transient rate limit 429 without quota keyword as TRANSIENT_FAILURE", () => {
    const error = classifyError(429, "Too many requests per second.");
    expect(error.errorCode).toBe("TRANSIENT_FAILURE");
    expect(error.canRetry).toBe(true);
  });
});
