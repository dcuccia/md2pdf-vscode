# Cross-Repo Migration Plan: Pure Node.js Architecture

**Repos**: [md2pdf](https://github.com/dcuccia/md2pdf) + [md2pdf-vscode](https://github.com/dcuccia/md2pdf-vscode)
**Date**: 2026-03-12 (updated)
**Approach**: Dovetail — both repos evolve together, retaining the layered architecture

---

## Guiding Principles

1. **Dovetail, don't diverge** — the CLI and extension share conventions and eventually code, not just syntax specs
2. **Layered architecture** — md2pdf provides the pipeline library; md2pdf-vscode wraps it for VS Code
3. **No auto-merge** — all changes via PRs with review
4. **Cross-repo coordination** — PRs reference each other; CI validates the integration
5. **Two PRs, not four** — consolidated to minimize integration risk

---

## Architecture: Before and After

### Current (Python + Playwright)

```
md2pdf repo (core library):
  lib/md2svg.py     → SVG chart generation (Python)
  lib/md2html.py    → MD → HTML (Python markdown lib)
  lib/html2pdf.js   → HTML → PDF (Playwright + downloaded Chromium)
  themes/*.css      → shared CSS themes
  md2pdf.sh/ps1     → CLI wrapper

md2pdf-vscode repo (extension):
  scripts/bundle-pipeline.js → copies md2pdf/lib/*.py + html2pdf.js + themes/
  src/converter.ts   → spawns python/node subprocesses
  src/dependencies.ts → checks/installs Python, pip, Playwright
```

### Target (Pure Node.js)

```
md2pdf repo (core library):
  lib/md2svg.js       → SVG chart generation (Node.js — markdown-it)
  lib/md2html.js      → MD → HTML (Node.js — markdown-it + transforms)
  lib/html2pdf.js     → HTML → PDF (puppeteer-core + system browser)
  lib/browser-detect.js → cross-platform browser detection
  lib/index.js        → barrel exports for programmatic use
  lib/md2svg.py       → SVG chart generation (kept for standalone Python use)
  lib/md2html.py      → MD → HTML (kept for standalone Python use)
  themes/*.css        → shared CSS themes (unchanged)
  md2pdf.sh/ps1       → CLI wrapper (Node.js by default, Python fallback)
  package.json        → publishable npm package with pipeline modules
  tests/              → Jest tests for Node.js pipeline + pytest for Python

md2pdf-vscode repo (extension):
  src/pipeline/*      → Local Node.js pipeline (used until md2pdf bundles)
  src/converter.ts    → calls pipeline modules in-process (no subprocess)
  src/dependencies.ts → checks system browser only
  scripts/bundle-pipeline.js → copies themes + JS modules from md2pdf
  pipeline/lib/       → bundled JS modules from md2pdf (when available)
  pipeline/themes/    → bundled CSS themes from md2pdf
  package.json        → markdown-it, js-yaml, puppeteer-core as dependencies
```

---

## Consolidated PR Sequence (2 PRs)

### PR A: md2pdf-vscode — Node.js pipeline + integration-ready ← **THIS PR**

**Branch**: `copilot/evaluate-nodejs-architecture`
**Consolidates**: Original PRs 1 and 3

This PR implements the full Node.js pipeline in the extension AND prepares for
seamless integration with md2pdf's future Node.js modules:

- [x] Add Node.js pipeline modules (`src/pipeline/`)
  - `browser-detect.ts` — cross-platform browser detection
  - `md2svg.ts` — port of md2svg.py to TypeScript
  - `md2html.ts` — port of md2html.py using markdown-it
  - `html2pdf.ts` — port to puppeteer-core + system browser
  - `index.ts` — barrel exports
- [x] Update `converter.ts` — use in-process pipeline (no subprocess spawning)
- [x] Update `dependencies.ts` — browser detection only (no Python/pip)
- [x] Update `package.json` — add markdown-it, js-yaml, puppeteer-core; add browserPath setting; remove pythonPath/nodePath
- [x] Update tests for new architecture
- [x] Add CI workflow (`.github/workflows/ci.yml`)
- [x] Update release workflow
- [x] Update documentation
- [x] **Integration-ready**: `bundle-pipeline.js` detects and bundles md2pdf's
  Node.js modules when available (themes always, JS modules when md2pdf ships them)
- [x] **Spec document**: `docs/md2pdf-nodejs-spec.md` — exact specification for
  what md2pdf needs to implement

**How integration works**: When md2pdf ships Node.js modules (PR B), running
`npm run bundle-pipeline` in the extension automatically detects and bundles them
into `pipeline/lib/`. No code changes needed in the extension — just rebuild.

### PR B: md2pdf — Node.js pipeline modules + npm packaging

**Branch**: to be created in `dcuccia/md2pdf`
**Consolidates**: Original PRs 2 and 4
**Specification**: See [`docs/md2pdf-nodejs-spec.md`](./md2pdf-nodejs-spec.md) for exact details

This PR adds Node.js equivalents of the Python pipeline scripts and makes the
package publishable to npm:

- [ ] Add `lib/md2svg.js` — SVG chart generation (ported from TypeScript in md2pdf-vscode)
- [ ] Add `lib/md2html.js` — MD → HTML via markdown-it + transform pipeline
- [ ] Add `lib/browser-detect.js` — cross-platform browser detection
- [ ] Update `lib/html2pdf.js` — switch from Playwright to puppeteer-core + system browser
- [ ] Add `lib/index.js` — barrel exports for programmatic use
- [ ] Update `package.json` — add markdown-it, js-yaml, puppeteer-core; make npm-publishable
- [ ] Update `md2pdf.sh` / `md2pdf.ps1` — use Node.js pipeline by default, Python as fallback
- [ ] Add Jest tests for Node.js pipeline modules
- [ ] Update CI — test both Node.js and Python pipelines; add cross-repo integration test
- [ ] Keep Python scripts for backward compatibility
- [ ] Update README.md and docs

---

## Evaluation: "Done" Criteria

### PR A Complete (md2pdf-vscode — this PR)

| Criterion | Status | Validation |
|---|---|---|
| TypeScript compiles without errors | ✅ | `npm run compile` |
| All tests pass | ✅ | `npm test` (unit tests) |
| No Python runtime dependency | ✅ | No `spawn python` in converter.ts |
| No Playwright dependency | ✅ | Only puppeteer-core in package.json |
| System browser detection works on all platforms | ✅ | Well-known paths for win32/darwin/linux |
| browserPath setting available | ✅ | package.json contributes.configuration |
| All 6 transforms ported | ✅ | md2html.ts transform pipeline |
| All 5 chart types ported | ✅ | md2svg.ts chart generators |
| Frontmatter parsing works | ✅ | md2html.ts parseFrontmatter() |
| CI on 3 OSes × 3 Node versions | ✅ | .github/workflows/ci.yml |
| Bundle script copies themes | ✅ | scripts/bundle-pipeline.js |
| Bundle script detects md2pdf JS modules | ✅ | Copies lib/*.js when available |
| HTML export works without browser | ✅ | Converter skips PDF step |
| PDF export uses system Chrome/Edge | ✅ | puppeteer-core + detectBrowser() |
| Spec for PR B exists | ✅ | docs/md2pdf-nodejs-spec.md |

### PR B Complete (md2pdf — future)

| Criterion | Validation |
|---|---|
| Node.js pipeline modules in lib/ | `lib/md2svg.js`, `lib/md2html.js`, `lib/browser-detect.js`, `lib/index.js` exist |
| `html2pdf.js` uses puppeteer-core | No `require("playwright")` in lib/html2pdf.js |
| npm-publishable package.json | `main` field, exports, proper metadata |
| CLI works with Node.js pipeline | `./md2pdf.sh doc.md` produces PDF without Python |
| Python pipeline still works | `python lib/md2html.py` still functions |
| CI tests Node.js + Python pipelines | CI matrix includes both |
| Cross-repo integration test passes | Extension bundles md2pdf's JS modules successfully |
| SVG chart output matches | Visual diff or byte comparison between Python and JS |
| HTML output matches | Diff of generated HTML between Python and JS |

### Cross-Repo Integration Complete

| Criterion | Validation |
|---|---|
| Extension bundles md2pdf JS modules | `npm run bundle-pipeline` copies lib/*.js |
| `pipeline/lib/manifest.json` generated | Confirms bundled module source |
| Both repos' CI green | No regressions |
| End-to-end: md → HTML works | Extension export produces correct HTML |
| End-to-end: md → PDF works | Extension export produces correct PDF |
| No duplicate logic long-term | src/pipeline/ can be removed after md2pdf ships modules |

---

## CI Architecture

### md2pdf-vscode CI (this repo)

```yaml
# .github/workflows/ci.yml
matrix:
  os: [ubuntu-latest, windows-latest, macos-latest]
  node: [18, 20, 22]
steps:
  - Checkout extension
  - Checkout md2pdf (for themes + JS modules when available)
  - npm ci
  - npm run compile
  - npm run bundle-pipeline  # copies themes; copies JS modules when available
```

### md2pdf CI (core repo — proposed in PR B)

```yaml
# .github/workflows/ci.yml
jobs:
  test-python:  # keep existing
    matrix: { os: [ubuntu, windows], python: [3.10, 3.11, 3.12] }
    steps: python -m pytest tests/ -v

  test-node:  # update to use puppeteer-core
    matrix: { os: [ubuntu, windows, macos], node: [18, 20, 22] }
    steps:
      - npm install
      - Install system browser (CI has Chrome)
      - npx jest --verbose

  test-integration:  # new — cross-repo validation
    steps:
      - Checkout md2pdf
      - Checkout md2pdf-vscode
      - npm ci (in extension dir)
      - npm run bundle-pipeline (should bundle JS modules)
      - npm run compile
      - Verify pipeline/lib/manifest.json exists
```

---

## Shared Conventions (Unchanged)

These conventions are shared between CLI and extension, regardless of implementation language:

| Convention | Specification |
|---|---|
| `@chart` syntax | YAML fenced blocks with `# @chart → filename.svg` |
| Pipe table charts | `<!-- @chart: type → filename.svg -->` + pipe table |
| Chart types | bar, hbar, pie, donut, sunburst |
| Frontmatter keys | title, author, date, theme, image_scale, margin_* |
| Themes | CSS files in `themes/` directory |
| Alerts | `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` |
| Math | `$inline$`, `$$block$$` |
| Page breaks | `<!-- pagebreak -->` |
| Task lists | `- [ ]`, `- [x]` |
| Mermaid | `` ```mermaid `` fenced blocks |

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|---|---|---|
| PR A: md2pdf-vscode (pipeline + integration-ready) | Done | None |
| PR B: md2pdf (Node.js modules + npm packaging) | 3–5 days | PR A merged |
| Integration validation | 1 day | PR B merged |
| Optional: Remove src/pipeline/ from md2pdf-vscode | 1 day | Integration validated |
