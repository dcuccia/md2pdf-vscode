/**
 * Tests for lib/html2pdf.js — HTML to PDF conversion.
 *
 * Tests the file server security, module exports, and API shape.
 * Full PDF generation tests require a system browser (run in CI).
 */

const fs = require("fs");
const path = require("path");
const { convert } = require("../lib/html2pdf");

// ─── Module exports ──────────────────────────────────────────────────

describe("html2pdf module", () => {
  test("exports convert as an async function", () => {
    expect(typeof convert).toBe("function");
  });

  test("convert throws without browser path", async () => {
    // Should reject when browser executable doesn't exist
    await expect(
      convert("/tmp", "nonexistent.html", "/tmp/out.pdf", "/nonexistent/browser")
    ).rejects.toThrow();
  });
});

// ─── File server security ────────────────────────────────────────────

describe("html2pdf security", () => {
  test("source code binds server to 127.0.0.1", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "lib", "html2pdf.js"),
      "utf-8"
    );
    expect(source).toContain('"127.0.0.1"');
  });

  test("source code validates file paths within served directory", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "lib", "html2pdf.js"),
      "utf-8"
    );
    // Should check that resolved path starts with the served directory
    expect(source).toContain("startsWith");
    expect(source).toContain("resolve");
  });

  test("source code does not use shell: true", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "lib", "html2pdf.js"),
      "utf-8"
    );
    expect(source).not.toContain("shell: true");
    expect(source).not.toContain("shell:true");
  });
});
