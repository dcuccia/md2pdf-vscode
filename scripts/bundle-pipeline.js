/**
 * Copies the md2pdf pipeline scripts and themes into the extension's
 * pipeline/ directory for bundled distribution.
 *
 * Run via: npm run bundle-pipeline
 *
 * Expects the md2pdf repo to be a sibling directory (../md2pdf).
 * Only copies the files needed at runtime — no tests, docs, or dev files.
 */

const fs = require("fs");
const path = require("path");

const SOURCE = process.env.MD2PDF_SOURCE
  ? path.resolve(process.env.MD2PDF_SOURCE)
  : path.resolve(__dirname, "..", "..", "md2pdf");
const DEST = path.resolve(__dirname, "..", "pipeline");

const FILES_TO_COPY = [
  // Pipeline scripts
  { src: "lib/md2svg.py", dest: "lib/md2svg.py" },
  { src: "lib/md2html.py", dest: "lib/md2html.py" },
  { src: "lib/html2pdf.js", dest: "lib/html2pdf.js" },
  // Themes
  { src: "themes/default.css", dest: "themes/default.css" },
  { src: "themes/academic.css", dest: "themes/academic.css" },
  { src: "themes/minimal.css", dest: "themes/minimal.css" },
  // Dependency manifests
  { src: "requirements.txt", dest: "requirements.txt" },
  { src: "package.json", dest: "package.json" },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(
      `Error: md2pdf source not found at ${SOURCE}\n` +
        "Clone https://github.com/dcuccia/md2pdf as a sibling directory."
    );
    process.exit(1);
  }

  // Clean and recreate
  if (fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true });
  }

  for (const { src, dest } of FILES_TO_COPY) {
    const srcPath = path.join(SOURCE, src);
    const destPath = path.join(DEST, dest);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Warning: ${srcPath} not found, skipping`);
      continue;
    }

    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ${src} → pipeline/${dest}`);
  }

  console.log(`\nBundled ${FILES_TO_COPY.length} files into pipeline/`);
}

main();
