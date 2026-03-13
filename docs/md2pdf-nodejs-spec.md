# md2pdf Node.js Pipeline — Implementation Specification

**Target repo**: [dcuccia/md2pdf](https://github.com/dcuccia/md2pdf)
**Source**: Ported from [md2pdf-vscode/src/pipeline/](https://github.com/dcuccia/md2pdf-vscode/tree/copilot/evaluate-nodejs-architecture/src/pipeline)
**Date**: 2026-03-12

This document specifies the exact changes needed in the md2pdf core repository
to add Node.js pipeline modules alongside the existing Python scripts. This is
PR B of the [cross-repo migration plan](./cross-repo-migration-plan.md).

---

## Overview

Add Node.js equivalents of the three Python pipeline scripts (`md2svg.py`,
`md2html.py`) plus the existing `html2pdf.js` (updated to use puppeteer-core
instead of Playwright). Keep Python scripts for backward compatibility. Make the
package publishable to npm so the VS Code extension can eventually consume it
as a dependency.

---

## New Files

### `lib/md2svg.js`

**Source**: Compile from `md2pdf-vscode/src/pipeline/md2svg.ts`

Port of `lib/md2svg.py` to Node.js. Same chart generation logic:
- Scans markdown for `@chart` YAML blocks and pipe table charts
- Generates SVG files for: bar, hbar, pie, donut, sunburst
- Uses same Tableau 10 color palette
- Same SVG structure and layout

**Exports**:
```javascript
module.exports = {
  generateCharts,  // (mdPath: string) => string[] — generates SVGs, returns filenames
  scanCharts,      // (mdText: string) => ChartSpec[] — parses chart blocks
};
```

**Dependencies**: `js-yaml` (for YAML parsing)

### `lib/md2html.js`

**Source**: Compile from `md2pdf-vscode/src/pipeline/md2html.ts`

Port of `lib/md2html.py` to Node.js using `markdown-it`. Same transform pipeline:
1. `transformMermaid` — fenced mermaid blocks → Mermaid CDN script
2. `transformAlerts` — GitHub `[!NOTE]`/`[!TIP]`/etc. → styled callout divs
3. `transformTaskLists` — `- [ ]`/`- [x]` → HTML checkboxes
4. `transformSyntaxHighlight` — code blocks → Highlight.js CDN
5. `transformMath` — `$inline$`/`$$block$$` → KaTeX CDN
6. `transformPageBreaks` — `<!-- pagebreak -->` → CSS page breaks

**Exports**:
```javascript
module.exports = {
  convert,           // (mdPath, htmlPath, cssPath, imageScale?) => number — returns file size
  parseFrontmatter,  // (mdText: string) => [remaining, meta]
  runTransforms,     // (html: string) => [html, scripts[], styles[]]
};
```

**Dependencies**: `markdown-it`, `js-yaml`

### `lib/browser-detect.js`

**Source**: Compile from `md2pdf-vscode/src/pipeline/browser-detect.ts`

Cross-platform detection of installed Chromium-based browsers:
- Checks env vars: `CHROME_PATH`, `CHROMIUM_PATH`
- Checks well-known paths for win32/darwin/linux
- Returns executable path or null

**Exports**:
```javascript
module.exports = {
  detectBrowser,        // (configuredPath?: string) => string | null
  getBrowserInstallHint, // () => string
};
```

**Dependencies**: None (only uses `fs` and `path`)

### `lib/index.js`

**New file** — barrel exports for programmatic use:

```javascript
const { generateCharts, scanCharts } = require("./md2svg");
const { convert: convertMdToHtml, parseFrontmatter, runTransforms } = require("./md2html");
const { convert: convertHtmlToPdf, createFileServer } = require("./html2pdf");
const { detectBrowser, getBrowserInstallHint } = require("./browser-detect");

module.exports = {
  // md2svg
  generateCharts,
  scanCharts,
  // md2html
  convertMdToHtml,
  parseFrontmatter,
  runTransforms,
  // html2pdf
  convertHtmlToPdf,
  createFileServer,
  // browser-detect
  detectBrowser,
  getBrowserInstallHint,
};
```

---

## Updated Files

### `lib/html2pdf.js`

**Change**: Replace `playwright` with `puppeteer-core` + system browser detection.

Key changes:
```diff
- const { chromium } = require("playwright");
+ const puppeteer = require("puppeteer-core");
+ const { detectBrowser } = require("./browser-detect");

  async function convert(dir, htmlName, pdfPath, options = {}) {
+   const browserPath = options.browserPath || detectBrowser();
+   if (!browserPath) {
+     throw new Error("No Chrome/Edge browser found. Install Chrome or set CHROME_PATH.");
+   }

-   browser = await chromium.launch();
+   browser = await puppeteer.launch({
+     executablePath: browserPath,
+     headless: true,
+     args: ["--no-sandbox", "--disable-setuid-sandbox"],
+   });

    // ... rest stays the same (server, page.goto, waitForFunction, page.pdf)

-   await page.goto(url, { waitUntil: "networkidle" });
+   await page.goto(url, { waitUntil: "networkidle0" });
```

Also add path traversal protection to the file server:
```javascript
function createFileServer(dir) {
  return http.createServer((req, res) => {
    const filePath = path.join(dir, decodeURIComponent(req.url.replace(/^\//, "")));

    // Security: ensure resolved path is within the served directory
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(dir))) {
      res.writeHead(403);
      res.end();
      return;
    }

    // ... existing logic
  });
}
```

### `package.json`

**Changes**:
```json
{
  "name": "md2pdf",
  "version": "0.2.0",
  "description": "Markdown to styled HTML + PDF converter with inline chart generation",
  "main": "lib/index.js",
  "files": ["lib/", "themes/"],
  "exports": {
    ".": "./lib/index.js",
    "./themes/*": "./themes/*"
  },
  "scripts": {
    "test": "npx jest --verbose",
    "test:py": "python -m pytest tests/ -v",
    "test:all": "python -m pytest tests/ -v && npx jest --verbose",
    "convert": "node lib/html2pdf.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "js-yaml": "^4.1.1",
    "markdown-it": "^14.1.1",
    "puppeteer-core": "^24.39.0"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  },
  "peerDependencies": {
    "playwright": "^1.58.2"
  },
  "peerDependenciesMeta": {
    "playwright": {
      "optional": true
    }
  }
}
```

Key changes:
- Add `main`, `files`, `exports` for npm publishability
- Add `markdown-it`, `js-yaml`, `puppeteer-core` as dependencies
- Move `playwright` to optional peerDependency (backward compat)
- Bump version to 0.2.0

### `md2pdf.sh`

**Change**: Default to Node.js pipeline, fallback to Python:

```bash
# Try Node.js pipeline first (no Python required)
if command -v node &> /dev/null && node -e "require('./lib/md2html')" 2>/dev/null; then
  # Node.js pipeline
  node -e "
    const { generateCharts } = require('./lib/md2svg');
    const { convert: md2html } = require('./lib/md2html');
    const { convert: html2pdf } = require('./lib/html2pdf');
    // ... run pipeline
  " "$INPUT" "$HTML_PATH" "$PDF_PATH" "$THEME_CSS"
else
  # Fallback to Python pipeline
  python "$SCRIPT_DIR/lib/md2svg.py" "$INPUT"
  python "$SCRIPT_DIR/lib/md2html.py" "$INPUT" "$HTML_PATH" "$THEME_CSS"
  node "$SCRIPT_DIR/lib/html2pdf.js" "$INPUT_DIR" "$HTML_NAME" "$PDF_PATH"
fi
```

### `md2pdf.ps1`

Same logic as `md2pdf.sh` but in PowerShell syntax.

---

## New Test Files

### `tests/md2svg.test.js`

Jest tests for the Node.js md2svg module:

```javascript
const { scanCharts, generateCharts } = require("../lib/md2svg");
const fs = require("fs");
const path = require("path");

describe("scanCharts", () => {
  test("parses YAML @chart blocks", () => {
    const md = `
\`\`\`yaml
# @chart → test.svg
type: bar
data:
  A: 10
  B: 20
\`\`\`
`;
    const specs = scanCharts(md);
    expect(specs).toHaveLength(1);
    expect(specs[0]._filename).toBe("test.svg");
    expect(specs[0].type).toBe("bar");
  });

  test("parses pipe table charts", () => {
    const md = `
<!-- @chart: bar → table.svg -->
| Label | Value |
|-------|-------|
| A     | 10    |
| B     | 20    |
`;
    const specs = scanCharts(md);
    expect(specs).toHaveLength(1);
    expect(specs[0]._filename).toBe("table.svg");
  });

  test("generates all chart types", () => {
    for (const type of ["bar", "hbar", "pie", "donut", "sunburst"]) {
      // Test each chart type generates valid SVG
    }
  });
});
```

### `tests/md2html.test.js`

Jest tests for the Node.js md2html module:

```javascript
const { parseFrontmatter, runTransforms, convert } = require("../lib/md2html");

describe("parseFrontmatter", () => {
  test("extracts YAML frontmatter", () => {
    const [remaining, meta] = parseFrontmatter("---\ntitle: Test\n---\n# Hello");
    expect(meta.title).toBe("Test");
    expect(remaining).toBe("# Hello");
  });

  test("returns empty object when no frontmatter", () => {
    const [remaining, meta] = parseFrontmatter("# No frontmatter");
    expect(meta).toEqual({});
    expect(remaining).toBe("# No frontmatter");
  });
});

describe("runTransforms", () => {
  test("transforms mermaid blocks", () => {
    const html = '<pre><code class="language-mermaid">graph LR\nA-->B</code></pre>';
    const [result, scripts] = runTransforms(html);
    expect(result).toContain('class="mermaid"');
    expect(scripts.some(s => s.includes("mermaid"))).toBe(true);
  });

  test("transforms GitHub alerts", () => {
    const html = "<blockquote><p>[!NOTE]\nThis is a note</p></blockquote>";
    const [result] = runTransforms(html);
    expect(result).toContain("md2pdf-alert");
  });

  // ... tests for all 6 transforms
});
```

### `tests/browser-detect.test.js`

```javascript
const { detectBrowser, getBrowserInstallHint } = require("../lib/browser-detect");

describe("detectBrowser", () => {
  test("returns string or null", () => {
    const result = detectBrowser();
    expect(typeof result === "string" || result === null).toBe(true);
  });

  test("respects configured path", () => {
    // Only test with a path that exists on the system
    const result = detectBrowser("/nonexistent/browser");
    expect(result).not.toBe("/nonexistent/browser");
  });
});

describe("getBrowserInstallHint", () => {
  test("returns platform-specific hint", () => {
    const hint = getBrowserInstallHint();
    expect(hint.length).toBeGreaterThan(0);
  });
});
```

---

## CI Updates

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  test-python:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        python-version: ["3.10", "3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      - name: Run Python tests
        run: python -m pytest tests/ -v

  test-node:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - name: Install dependencies
        run: npm install
      - name: Run JS tests
        run: npx jest --verbose

  test-integration:
    runs-on: ubuntu-latest
    needs: [test-node]
    steps:
      - name: Checkout md2pdf
        uses: actions/checkout@v4

      - name: Checkout md2pdf-vscode
        uses: actions/checkout@v4
        with:
          repository: dcuccia/md2pdf-vscode
          path: md2pdf-vscode

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install extension dependencies
        run: npm ci
        working-directory: md2pdf-vscode

      - name: Bundle pipeline from md2pdf
        run: npm run bundle-pipeline
        working-directory: md2pdf-vscode
        env:
          MD2PDF_SOURCE: ${{ github.workspace }}

      - name: Compile extension
        run: npm run compile
        working-directory: md2pdf-vscode

      - name: Verify bundled modules
        run: |
          test -f md2pdf-vscode/pipeline/lib/manifest.json
          echo "✓ Pipeline modules bundled successfully"
          cat md2pdf-vscode/pipeline/lib/manifest.json
```

---

## Porting Process

The TypeScript modules in `md2pdf-vscode/src/pipeline/` were written to be
portable. To convert them to CommonJS for the md2pdf repo:

### Option A: Manual conversion (recommended)

1. Copy each `.ts` file
2. Remove TypeScript type annotations
3. Replace `import` with `require()`
4. Replace `export function` with `module.exports = { ... }`
5. Run through the existing Python test fixtures to validate output matches

### Option B: Compile with tsc

1. Copy `.ts` files to a temp directory
2. Create a minimal `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "outDir": "../lib",
       "declaration": false,
       "strict": false
     }
   }
   ```
3. Run `tsc`
4. Clean up the output (remove source maps, simplify)

### Validation

After porting, validate output matches between Python and Node.js:

```bash
# Generate reference output with Python
python lib/md2svg.py tests/fixtures/charts.md
python lib/md2html.py tests/fixtures/sample.md /tmp/py-output.html themes/default.css

# Generate output with Node.js
node -e "require('./lib/md2svg').generateCharts('tests/fixtures/charts.md')"
node -e "require('./lib/md2html').convert('tests/fixtures/sample.md', '/tmp/js-output.html', 'themes/default.css')"

# Compare
diff /tmp/py-output.html /tmp/js-output.html
```

---

## Backward Compatibility

- Python scripts (`lib/md2svg.py`, `lib/md2html.py`) remain unchanged
- `requirements.txt` remains unchanged
- `playwright` becomes an optional peer dependency
- CLI wrappers (`md2pdf.sh`, `md2pdf.ps1`) default to Node.js but fall back to Python
- Existing Python tests continue to run unchanged
- Users who prefer Python can set an environment variable: `MD2PDF_ENGINE=python`
