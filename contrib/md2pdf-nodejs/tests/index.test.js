/**
 * Tests for lib/index.js — Barrel exports validation.
 *
 * Verifies that all pipeline modules are accessible through the main entry point.
 */

const md2pdf = require("../lib/index");

describe("md2pdf barrel exports", () => {
  test("exports generateCharts function", () => {
    expect(typeof md2pdf.generateCharts).toBe("function");
  });

  test("exports scanCharts function", () => {
    expect(typeof md2pdf.scanCharts).toBe("function");
  });

  test("exports convertMdToHtml function", () => {
    expect(typeof md2pdf.convertMdToHtml).toBe("function");
  });

  test("exports parseFrontmatter function", () => {
    expect(typeof md2pdf.parseFrontmatter).toBe("function");
  });

  test("exports runTransforms function", () => {
    expect(typeof md2pdf.runTransforms).toBe("function");
  });

  test("exports convertHtmlToPdf function", () => {
    expect(typeof md2pdf.convertHtmlToPdf).toBe("function");
  });

  test("exports detectBrowser function", () => {
    expect(typeof md2pdf.detectBrowser).toBe("function");
  });

  test("exports getBrowserInstallHint function", () => {
    expect(typeof md2pdf.getBrowserInstallHint).toBe("function");
  });

  test("exports exactly 8 functions", () => {
    const exportedFunctions = Object.entries(md2pdf).filter(
      ([, v]) => typeof v === "function"
    );
    expect(exportedFunctions).toHaveLength(8);
  });
});
