"use strict";
/**
 * md2pdf — Node.js pipeline modules for Markdown → HTML → PDF conversion.
 *
 * Barrel export providing all pipeline functions for programmatic use.
 *
 * Usage:
 *   const md2pdf = require("md2pdf");
 *   md2pdf.generateCharts("doc.md");
 *   md2pdf.convertMdToHtml("doc.md", "doc.html", "theme.css");
 *   await md2pdf.convertHtmlToPdf(dir, "doc.html", "doc.pdf", browserPath);
 */
const md2svg = require("./md2svg");
const md2html = require("./md2html");
const html2pdf = require("./html2pdf");
const browserDetect = require("./browser-detect");

module.exports = {
  // md2svg — chart generation
  generateCharts: md2svg.generateCharts,
  scanCharts: md2svg.scanCharts,

  // md2html — markdown to HTML conversion
  convertMdToHtml: md2html.convert,
  parseFrontmatter: md2html.parseFrontmatter,
  runTransforms: md2html.runTransforms,

  // html2pdf — HTML to PDF conversion
  convertHtmlToPdf: html2pdf.convert,

  // browser-detect — system browser detection
  detectBrowser: browserDetect.detectBrowser,
  getBrowserInstallHint: browserDetect.getBrowserInstallHint,
};
