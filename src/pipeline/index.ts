/**
 * md2pdf pipeline — Node.js conversion modules.
 *
 * This barrel module exports the three pipeline stages:
 * - md2svg: YAML @chart blocks → SVG files
 * - md2html: Markdown → styled HTML
 * - html2pdf: HTML → PDF via system browser
 *
 * Plus the browser detection utility.
 *
 * These modules are designed to be portable — they will eventually live
 * in the md2pdf core library (dcuccia/md2pdf) and be shared by both
 * the CLI and the VS Code extension.
 */

export { generateCharts, scanCharts } from "./md2svg";
export type { ChartSpec } from "./md2svg";

export { convert as convertMdToHtml, parseFrontmatter, runTransforms } from "./md2html";
export type { FrontmatterMeta } from "./md2html";

export { convert as convertHtmlToPdf } from "./html2pdf";
export type { PdfOptions } from "./html2pdf";

export { detectBrowser, getBrowserInstallHint } from "./browser-detect";
