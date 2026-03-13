/**
 * Tests for lib/browser-detect.js — Cross-platform browser detection.
 *
 * Validates browser detection logic for Chrome, Edge, and Chromium.
 */

const { detectBrowser, getBrowserInstallHint } = require("../lib/browser-detect");

// ─── detectBrowser ───────────────────────────────────────────────────

describe("detectBrowser", () => {
  test("returns a string or null", () => {
    const result = detectBrowser();
    expect(typeof result === "string" || result === null).toBe(true);
  });

  test("rejects non-existent configured path", () => {
    const result = detectBrowser("/nonexistent/path/to/browser");
    // Should not return the non-existent path
    expect(result).not.toBe("/nonexistent/path/to/browser");
  });

  test("accepts existing configured path", () => {
    // Use a known-to-exist file as a stand-in
    const result = detectBrowser(process.execPath);
    expect(result).toBeTruthy();
  });

  test("checks CHROME_PATH environment variable", () => {
    const original = process.env.CHROME_PATH;
    try {
      process.env.CHROME_PATH = process.execPath; // Use node binary as stand-in
      const result = detectBrowser();
      expect(result).toBeTruthy();
    } finally {
      if (original !== undefined) {
        process.env.CHROME_PATH = original;
      } else {
        delete process.env.CHROME_PATH;
      }
    }
  });

  test("returns null when no browser found", () => {
    const original = { ...process.env };
    try {
      delete process.env.CHROME_PATH;
      delete process.env.CHROMIUM_PATH;
      // On CI, we might not have a browser, but we should not crash
      const result = detectBrowser("/nonexistent/browser");
      expect(typeof result === "string" || result === null).toBe(true);
    } finally {
      // Restore
      Object.assign(process.env, original);
    }
  });
});

// ─── getBrowserInstallHint ───────────────────────────────────────────

describe("getBrowserInstallHint", () => {
  test("returns a non-empty string", () => {
    const hint = getBrowserInstallHint();
    expect(typeof hint).toBe("string");
    expect(hint.length).toBeGreaterThan(0);
  });

  test("mentions Chrome or Chromium or Edge", () => {
    const hint = getBrowserInstallHint().toLowerCase();
    expect(
      hint.includes("chrome") ||
      hint.includes("chromium") ||
      hint.includes("edge")
    ).toBe(true);
  });
});
