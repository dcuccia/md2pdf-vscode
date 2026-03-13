# Applying PR B: Node.js Pipeline Modules for md2pdf

This directory contains the **complete implementation** of PR B — the Node.js
pipeline modules for the [dcuccia/md2pdf](https://github.com/dcuccia/md2pdf)
core repository. These files are generated from the TypeScript pipeline modules
in `md2pdf-vscode/src/pipeline/` and are ready to be applied.

## What's Included

```
contrib/md2pdf-nodejs/
├── lib/                          # Node.js pipeline modules (ready to copy)
│   ├── index.js                  # Barrel exports (new)
│   ├── md2svg.js                 # Chart generation (new — replaces md2svg.py)
│   ├── md2html.js                # MD → HTML conversion (new — replaces md2html.py)
│   ├── html2pdf.js               # HTML → PDF (updated — puppeteer-core replaces Playwright)
│   └── browser-detect.js         # Browser detection (new)
├── tests/                        # Jest test files (ready to copy)
│   ├── md2svg.test.js
│   ├── md2html.test.js
│   ├── html2pdf.test.js
│   ├── browser-detect.test.js
│   └── index.test.js
├── .github/workflows/ci.yml      # Updated CI workflow
├── package.json                   # Updated package.json (npm-publishable)
└── APPLY.md                       # This file
```

## How to Apply

### Option 1: Copy Files Directly

```bash
# From the md2pdf repository root:

# 1. Copy new/updated lib files
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/lib/index.js lib/
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/lib/md2svg.js lib/
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/lib/md2html.js lib/
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/lib/html2pdf.js lib/
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/lib/browser-detect.js lib/

# 2. Copy test files (alongside existing Python tests)
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/tests/*.test.js tests/

# 3. Update package.json
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/package.json .

# 4. Update CI workflow
cp ../md2pdf-vscode/contrib/md2pdf-nodejs/.github/workflows/ci.yml .github/workflows/

# 5. Install new dependencies
npm install

# 6. Run tests
npx jest --verbose
```

### Option 2: Use the Generation Script

If you want to regenerate from the latest TypeScript source:

```bash
# From the md2pdf-vscode repository:
node scripts/generate-md2pdf-modules.js
```

This compiles `src/pipeline/*.ts` → `contrib/md2pdf-nodejs/lib/*.js` and verifies
all exports load correctly.

## What Changes

### New Files
| File | Purpose |
|------|---------|
| `lib/index.js` | Barrel exports for npm package (`require("md2pdf")`) |
| `lib/md2svg.js` | SVG chart generation from YAML @chart blocks |
| `lib/md2html.js` | Markdown → HTML via markdown-it + transform pipeline |
| `lib/browser-detect.js` | Cross-platform Chrome/Edge/Chromium detection |
| `tests/md2svg.test.js` | Jest tests for chart scanning and generation |
| `tests/md2html.test.js` | Jest tests for frontmatter, transforms, conversion |
| `tests/browser-detect.test.js` | Jest tests for browser detection |
| `tests/html2pdf.test.js` | Jest tests for PDF conversion (security, API) |
| `tests/index.test.js` | Jest tests for barrel exports |

### Updated Files
| File | Change |
|------|--------|
| `lib/html2pdf.js` | **Replaced Playwright with puppeteer-core** + system browser |
| `package.json` | Added `markdown-it`, `js-yaml`, `puppeteer-core`; npm-publishable |
| `.github/workflows/ci.yml` | Added Node.js test matrix + cross-repo integration test |

### Kept Unchanged
| File | Reason |
|------|--------|
| `lib/md2svg.py` | Backward compatibility (Python pipeline still works) |
| `lib/md2html.py` | Backward compatibility (Python pipeline still works) |
| `requirements.txt` | Python dependencies unchanged |
| `md2pdf.sh` | Shell wrapper (update separately if desired) |
| `md2pdf.ps1` | PowerShell wrapper (update separately if desired) |

## Key API Differences

### html2pdf.js (breaking change from Playwright to puppeteer-core)

```javascript
// BEFORE (Playwright — auto-downloads browser):
const { chromium } = require("playwright");
browser = await chromium.launch();

// AFTER (puppeteer-core — uses system browser):
const puppeteer = require("puppeteer-core");
browser = await puppeteer.launch({
  executablePath: browserPath,  // explicit path required
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
```

### New: browser-detect.js

```javascript
const { detectBrowser } = require("./browser-detect");
const browserPath = detectBrowser();
// Returns path like "/usr/bin/google-chrome" or null
```

### New: Barrel imports

```javascript
const md2pdf = require("md2pdf");
md2pdf.generateCharts("doc.md");
md2pdf.convertMdToHtml("doc.md", "doc.html", "theme.css");
await md2pdf.convertHtmlToPdf(dir, "doc.html", "doc.pdf", browserPath);
```

## Verification

After applying, verify with:

```bash
# Node.js tests
npx jest --verbose

# Python tests (should still pass — unchanged)
python -m pytest tests/ -v

# Cross-repo integration (from md2pdf-vscode)
MD2PDF_SOURCE=$(pwd) npm run bundle-pipeline
# Should output: "Bundling Node.js pipeline modules from md2pdf..."
```

## Security Notes

- `html2pdf.js` server binds to `127.0.0.1` only (no network access)
- File server validates paths are within served directory (no traversal)
- No `shell: true` or `child_process.exec` anywhere
- `puppeteer-core` uses system browser (no auto-download)
