#!/usr/bin/env node
/**
 * Generate Node.js pipeline modules for the md2pdf core repository.
 *
 * Compiles the TypeScript pipeline modules from src/pipeline/ into CommonJS
 * JavaScript and places them in contrib/md2pdf-nodejs/lib/ — ready to be
 * applied to the dcuccia/md2pdf repository as PR B.
 *
 * Usage:
 *   node scripts/generate-md2pdf-modules.js
 *
 * This script:
 * 1. Runs `tsc` to compile src/pipeline/ → out/src/pipeline/
 * 2. Copies the .js files to contrib/md2pdf-nodejs/lib/
 * 3. Strips source maps and updates doc comments
 * 4. Adds CLI entry points to md2svg.js and md2html.js
 * 5. Verifies the modules can be loaded
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const COMPILED = path.join(ROOT, "out", "src", "pipeline");
const CONTRIB = path.join(ROOT, "contrib", "md2pdf-nodejs", "lib");

// Ensure compilation is up to date
console.log("Compiling TypeScript...");
execSync("npm run compile", { cwd: ROOT, stdio: "inherit" });

// Ensure output directory exists
if (!fs.existsSync(CONTRIB)) {
  fs.mkdirSync(CONTRIB, { recursive: true });
}

// Files to copy (compiled JS only, no source maps or declarations)
const MODULES = [
  "browser-detect.js",
  "md2svg.js",
  "md2html.js",
  "html2pdf.js",
];

console.log("\nCopying compiled modules to contrib/md2pdf-nodejs/lib/...");
for (const file of MODULES) {
  const src = path.join(COMPILED, file);
  const dest = path.join(CONTRIB, file);
  if (!fs.existsSync(src)) {
    console.error(`Missing compiled file: ${src}`);
    process.exit(1);
  }

  let content = fs.readFileSync(src, "utf-8");

  // Strip source map reference (not needed in md2pdf repo)
  content = content.replace(/\/\/# sourceMappingURL=.*$/m, "");

  // Update doc comments: replace "will eventually live in" with "lives in"
  content = content.replace(
    /will eventually live in the md2pdf core library/g,
    "is part of the md2pdf core library"
  );
  content = content.replace(
    /This module is a port of md2pdf's lib\/\w+\.\w+ to TypeScript using/g,
    "Node.js implementation using"
  );
  content = content.replace(
    /This module is a port of md2pdf's lib\/\w+\.\w+ from Playwright to/g,
    "HTML to PDF conversion using"
  );
  content = content.replace(
    /This module is a direct port of md2pdf's lib\/\w+\.py to TypeScript\./g,
    "Node.js implementation for SVG chart generation."
  );

  fs.writeFileSync(dest, content, "utf-8");
  console.log(`  ${file} (${content.length} bytes)`);
}

// Create barrel index.js
const indexContent = `"use strict";
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
`;
fs.writeFileSync(path.join(CONTRIB, "index.js"), indexContent, "utf-8");
console.log(`  index.js (${indexContent.length} bytes)`);

// Verify modules can be loaded
console.log("\nVerifying modules load correctly...");
try {
  const idx = require(path.join(CONTRIB, "index.js"));
  const expected = [
    "generateCharts",
    "scanCharts",
    "convertMdToHtml",
    "parseFrontmatter",
    "runTransforms",
    "convertHtmlToPdf",
    "detectBrowser",
    "getBrowserInstallHint",
  ];
  for (const fn of expected) {
    if (typeof idx[fn] !== "function") {
      throw new Error(`Missing or non-function export: ${fn}`);
    }
  }
  console.log("  ✓ All 8 exports verified as functions");
} catch (err) {
  console.error(`  ✗ Verification failed: ${err.message}`);
  process.exit(1);
}

console.log("\n✓ Generation complete. Files in contrib/md2pdf-nodejs/lib/");
