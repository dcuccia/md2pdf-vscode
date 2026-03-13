/**
 * Bundles assets from the md2pdf core library into the extension's pipeline/
 * directory for distribution.
 *
 * Run via: npm run bundle-pipeline
 *
 * Bundles:
 * 1. Theme CSS files (always — shared between CLI and extension)
 * 2. Node.js pipeline modules (when available — from md2pdf's lib/ directory)
 *
 * When md2pdf ships Node.js pipeline modules (lib/md2svg.js, lib/md2html.js,
 * lib/html2pdf.js, lib/browser-detect.js), this script copies them into
 * pipeline/lib/ so the extension can use them instead of its own src/pipeline/
 * TypeScript copies. This enables the layered architecture: md2pdf owns the
 * pipeline, md2pdf-vscode wraps it.
 *
 * Until md2pdf ships those modules, the extension uses its own src/pipeline/
 * TypeScript modules (compiled to out/src/pipeline/). Both paths produce
 * identical behavior — the TypeScript modules were ported from the same source.
 *
 * Source resolution:
 *   1. MD2PDF_SOURCE environment variable (used in CI)
 *   2. Sibling directory (../md2pdf — local development)
 */

const fs = require("fs");
const path = require("path");

const SOURCE = process.env.MD2PDF_SOURCE
  ? path.resolve(process.env.MD2PDF_SOURCE)
  : path.resolve(__dirname, "..", "..", "md2pdf");
const DEST = path.resolve(__dirname, "..", "pipeline");

/** Theme CSS files — always copied when available. */
const THEME_FILES = [
  { src: "themes/default.css", dest: "themes/default.css" },
  { src: "themes/academic.css", dest: "themes/academic.css" },
  { src: "themes/minimal.css", dest: "themes/minimal.css" },
];

/**
 * Node.js pipeline modules — copied when md2pdf ships them.
 * These replace the extension's src/pipeline/ TypeScript modules.
 */
const PIPELINE_JS_FILES = [
  { src: "lib/md2svg.js", dest: "lib/md2svg.js" },
  { src: "lib/md2html.js", dest: "lib/md2html.js" },
  { src: "lib/html2pdf.js", dest: "lib/html2pdf.js" },
  { src: "lib/browser-detect.js", dest: "lib/browser-detect.js" },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Copy a list of files from SOURCE to DEST, returning count of copied files.
 */
function copyFiles(files, label) {
  let copied = 0;
  for (const { src, dest } of files) {
    const srcPath = path.join(SOURCE, src);
    const destPath = path.join(DEST, dest);

    if (!fs.existsSync(srcPath)) {
      continue;
    }

    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ${src} → pipeline/${dest}`);
    copied++;
  }
  if (copied > 0) {
    console.log(`  ✓ ${copied} ${label} file(s) bundled`);
  }
  return copied;
}

function main() {
  console.log(`md2pdf source: ${SOURCE}`);
  console.log(`bundle target: ${DEST}\n`);

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

  // 1. Bundle themes (always)
  console.log("Bundling themes...");
  const themesCopied = copyFiles(THEME_FILES, "theme");

  if (themesCopied === 0) {
    console.warn("Warning: No theme files found in md2pdf source");
    ensureDir(path.join(DEST, "themes"));
  }

  // 2. Bundle Node.js pipeline modules (when available)
  //
  // Check if md2pdf has shipped Node.js pipeline modules by looking for the
  // marker file: lib/md2html.js (the most complex module). If it exists with
  // the markdown-it-based implementation, bundle all JS modules.
  const md2htmlJs = path.join(SOURCE, "lib", "md2html.js");
  const hasNodePipeline = fs.existsSync(md2htmlJs) && (() => {
    // Verify it's the new markdown-it-based module, not something else
    const content = fs.readFileSync(md2htmlJs, "utf-8");
    return content.includes("markdown-it") || content.includes("markdownit");
  })();

  if (hasNodePipeline) {
    console.log("\nBundling Node.js pipeline modules from md2pdf...");
    const jsCopied = copyFiles(PIPELINE_JS_FILES, "pipeline");
    if (jsCopied > 0) {
      // Write a manifest so the extension knows bundled modules are available
      const manifest = {
        source: "md2pdf",
        bundledAt: new Date().toISOString(),
        modules: PIPELINE_JS_FILES
          .filter(f => fs.existsSync(path.join(DEST, f.dest)))
          .map(f => f.dest),
      };
      const manifestPath = path.join(DEST, "lib", "manifest.json");
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`  manifest.json → pipeline/lib/manifest.json`);
      console.log(`\n✓ Bundled pipeline uses md2pdf's Node.js modules`);
    }
  } else {
    console.log("\nNode.js pipeline modules not yet available in md2pdf.");
    console.log("Extension will use its own src/pipeline/ TypeScript modules.");
  }

  console.log("\nDone.");
}

main();
