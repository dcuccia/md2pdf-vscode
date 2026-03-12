/**
 * Copies the md2pdf themes into the extension's pipeline/ directory
 * for bundled distribution.
 *
 * Run via: npm run bundle-pipeline
 *
 * Expects the md2pdf repo to be a sibling directory (../md2pdf).
 * Only copies theme CSS files — the Node.js pipeline modules are now
 * built directly into the extension's TypeScript source (src/pipeline/).
 *
 * In the future, when the md2pdf core library ships Node.js modules,
 * this script will also bundle those.
 */

const fs = require("fs");
const path = require("path");

const SOURCE = process.env.MD2PDF_SOURCE
  ? path.resolve(process.env.MD2PDF_SOURCE)
  : path.resolve(__dirname, "..", "..", "md2pdf");
const DEST = path.resolve(__dirname, "..", "pipeline");

const FILES_TO_COPY = [
  // Themes (shared between CLI and extension)
  { src: "themes/default.css", dest: "themes/default.css" },
  { src: "themes/academic.css", dest: "themes/academic.css" },
  { src: "themes/minimal.css", dest: "themes/minimal.css" },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.warn(
      `Warning: md2pdf source not found at ${SOURCE}\n` +
        "Themes will not be bundled. Clone https://github.com/dcuccia/md2pdf as a sibling directory."
    );
    // Create empty themes directory so the extension can still build
    ensureDir(path.join(DEST, "themes"));
    return;
  }

  // Clean and recreate
  if (fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true });
  }

  let copied = 0;
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
    copied++;
  }

  console.log(`\nBundled ${copied} files into pipeline/`);
}

main();
