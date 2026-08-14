import { describe, expect, it } from "vitest";
import {
  formatCliError,
  markCliErrorReported,
  shouldPrintStackTrace,
  wasCliErrorReported,
} from "./errors.js";

describe("cli error helpers", () => {
  it("returns only the message for Error objects", () => {
    const error = new Error("Missing Docs Cloud API key.");
    expect(formatCliError(error)).toBe("Missing Docs Cloud API key.");
    expect(formatCliError(error)).not.toContain("at ");
  });

  it("handles string and unknown errors", () => {
    expect(formatCliError("  nope  ")).toBe("nope");
    expect(formatCliError(null)).toBe("An unexpected error occurred.");
  });

  it("tracks errors that were already printed by a command", () => {
    const error = new Error("Already printed");
    expect(wasCliErrorReported(error)).toBe(false);
    markCliErrorReported(error);
    expect(wasCliErrorReported(error)).toBe(true);
  });

  it("only enables stack traces with explicit debug env values", () => {
    expect(shouldPrintStackTrace({})).toBe(false);
    expect(shouldPrintStackTrace({ DOCS_DEBUG: "1" })).toBe(true);
    expect(shouldPrintStackTrace({ DEBUG: "@farming-labs/docs" })).toBe(true);
  });
});
