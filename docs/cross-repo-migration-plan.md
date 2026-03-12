# Cross-Repo Migration Plan: Pure Node.js Architecture

**Repos**: [md2pdf](https://github.com/dcuccia/md2pdf) + [md2pdf-vscode](https://github.com/dcuccia/md2pdf-vscode)
**Date**: 2026-03-12
**Approach**: Dovetail — both repos evolve together, retaining the layered architecture

---

## Guiding Principles

1. **Dovetail, don't diverge** — the CLI and extension share conventions and eventually code, not just syntax specs
2. **Layered architecture** — md2pdf provides the pipeline library; md2pdf-vscode wraps it for VS Code
3. **No auto-merge** — all changes via PRs with review
4. **Cross-repo coordination** — PRs reference each other; CI validates the integration

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
  lib/md2svg.js     → SVG chart generation (Node.js port)
  lib/md2html.js    → MD → HTML (markdown-it + plugins)
  lib/html2pdf.js   → HTML → PDF (puppeteer-core + system browser)
  lib/browser-detect.js → cross-platform browser detection
  lib/md2svg.py     → SVG chart generation (kept for standalone Python use)
  lib/md2html.py    → MD → HTML (kept for standalone Python use)
  themes/*.css      → shared CSS themes (unchanged)
  md2pdf.sh/ps1     → CLI wrapper (uses Node.js pipeline by default)
  package.json      → adds markdown-it, js-yaml, puppeteer-core

md2pdf-vscode repo (extension):
  src/pipeline/*    → Node.js pipeline modules (eventually imported from md2pdf)
  src/converter.ts  → calls pipeline modules in-process (no subprocess)
  src/dependencies.ts → checks system browser only
  scripts/bundle-pipeline.js → copies themes from md2pdf
  package.json      → markdown-it, js-yaml, puppeteer-core as dependencies
```

---

## PR Sequence

### PR 1: md2pdf-vscode — Node.js pipeline implementation ← **THIS PR**

**Branch**: `copilot/evaluate-nodejs-architecture`

Changes:
- [x] Add Node.js pipeline modules (`src/pipeline/`)
  - `browser-detect.ts` — cross-platform browser detection
  - `md2svg.ts` — port of md2svg.py to TypeScript
  - `md2html.ts` — port of md2html.py using markdown-it
  - `html2pdf.ts` — port to puppeteer-core + system browser
  - `index.ts` — barrel exports
- [x] Update `converter.ts` — use in-process pipeline (no subprocess spawning)
- [x] Update `dependencies.ts` — browser detection only (no Python/pip)
- [x] Update `package.json` — add markdown-it, js-yaml, puppeteer-core; add browserPath setting; remove pythonPath/nodePath
- [x] Update `scripts/bundle-pipeline.js` — copy themes only (no Python scripts)
- [x] Update tests for new architecture
- [x] Add CI workflow (`.github/workflows/ci.yml`)
- [x] Update release workflow
- [x] Update documentation

### PR 2: md2pdf — Add Node.js pipeline modules (FUTURE)

**Branch**: to be created in `dcuccia/md2pdf`

Changes needed:
- [ ] Add `lib/md2svg.js` — port from `md2pdf-vscode/src/pipeline/md2svg.ts` (compile to JS)
- [ ] Add `lib/md2html.js` — port from `md2pdf-vscode/src/pipeline/md2html.ts`
- [ ] Update `lib/html2pdf.js` — switch from Playwright to puppeteer-core + system browser
- [ ] Add `lib/browser-detect.js` — cross-platform browser detection
- [ ] Update `package.json` — add markdown-it, js-yaml, puppeteer-core; keep playwright as optional
- [ ] Update `md2pdf.sh` / `md2pdf.ps1` — use Node.js pipeline by default, Python as fallback
- [ ] Update CI (`ci.yml`) — add Node.js pipeline tests alongside existing Python tests
- [ ] Keep Python scripts (`lib/md2svg.py`, `lib/md2html.py`) for backward compatibility
- [ ] Update README.md and docs

### PR 3: md2pdf-vscode — Use md2pdf's published pipeline (FUTURE)

Once PR 2 lands, the extension can import the pipeline from md2pdf instead of maintaining its own copy:

- [ ] Update `scripts/bundle-pipeline.js` to copy `lib/*.js` from md2pdf
- [ ] Remove `src/pipeline/` (now bundled from md2pdf)
- [ ] Or: if md2pdf publishes an npm package, add it as a dependency

### PR 4: md2pdf — Optional CLI separation (FUTURE, if desired)

If the team decides to separate the CLI wrapper from the core library:
- [ ] Create `md2pdf-cli` repo with shell scripts and CLI entry point
- [ ] `md2pdf` becomes a pure Node.js library (publishable to npm)
- [ ] `md2pdf-cli` depends on `md2pdf` via npm
- [ ] `md2pdf-vscode` depends on `md2pdf` via npm

---

## Evaluation: "Done" Criteria

### Phase 1 Complete (This PR — md2pdf-vscode)

| Criterion | Status | Validation |
|---|---|---|
| TypeScript compiles without errors | ✅ | `npm run compile` |
| All tests pass | ✅ | `npm test` (unit tests) |
| No Python runtime dependency | ✅ | No `spawn python` in converter.ts |
| No Playwright dependency | ✅ | Only puppeteer-core in package.json |
| System browser detection works on all platforms | ✅ | Well-known paths for win32/darwin/linux |
| browserPath setting available | ✅ | package.json contributes.configuration |
| All 6 transforms ported (mermaid, alerts, math, syntax, tasks, pagebreaks) | ✅ | md2html.ts transform pipeline |
| All 5 chart types ported (bar, hbar, pie, donut, sunburst) | ✅ | md2svg.ts chart generators |
| Frontmatter parsing works | ✅ | md2html.ts parseFrontmatter() |
| CI workflow runs on ubuntu/windows/macos × Node 18/20/22 | ✅ | .github/workflows/ci.yml |
| Bundle script copies themes only | ✅ | scripts/bundle-pipeline.js |
| HTML export works without browser | ✅ | Converter skips PDF step |
| PDF export uses system Chrome/Edge | ✅ | puppeteer-core + detectBrowser() |

### Phase 2 Complete (Future — md2pdf)

| Criterion | Validation |
|---|---|
| Node.js pipeline modules added to lib/ | `lib/md2svg.js`, `lib/md2html.js`, `lib/browser-detect.js` exist |
| `html2pdf.js` uses puppeteer-core | No `require("playwright")` in lib/html2pdf.js |
| CLI works with Node.js pipeline | `./md2pdf.sh doc.md` produces PDF without Python |
| Python pipeline still works (backward compat) | `python lib/md2html.py` still functions |
| CI tests both Node.js and Python pipelines | CI matrix includes both |
| SVG chart output matches between Python and JS | Visual diff or byte comparison |
| HTML output matches between Python and JS | Diff of generated HTML |

### Phase 3 Complete (Future — integration)

| Criterion | Validation |
|---|---|
| Extension bundles JS pipeline from md2pdf repo | `bundle-pipeline.js` copies `lib/*.js` |
| No duplicate pipeline code | `src/pipeline/` removed from md2pdf-vscode |
| Cross-repo CI passes | Both repos' CI green |
| End-to-end: md → HTML works | Extension export produces correct HTML |
| End-to-end: md → PDF works | Extension export produces correct PDF |

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
  - Checkout md2pdf (for themes)
  - npm ci
  - npm run compile
  - npm run bundle-pipeline  # copies themes
```

### md2pdf CI (core repo — proposed update)

```yaml
# .github/workflows/ci.yml (updated)
jobs:
  test-python:  # existing
    matrix:
      os: [ubuntu-latest, windows-latest]
      python: [3.10, 3.11, 3.12]
    steps: python -m pytest tests/ -v

  test-node:  # updated to use puppeteer-core
    matrix:
      os: [ubuntu-latest, windows-latest]
      node: [18, 20, 22]
    steps:
      - npm install  # now installs markdown-it, js-yaml, puppeteer-core
      - npx jest --verbose

  test-integration:  # new — validates cross-repo compatibility
    steps:
      - Checkout md2pdf
      - Checkout md2pdf-vscode
      - npm ci (in extension dir)
      - npm run bundle-pipeline
      - npm run compile
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
| PR 1: md2pdf-vscode Node.js pipeline | Done | None |
| PR 2: md2pdf Node.js modules | 3–5 days | PR 1 merged (to port TypeScript back to JS) |
| PR 3: Integration (extension uses md2pdf's modules) | 1–2 days | PR 2 merged |
| PR 4: CLI separation (optional) | 2–3 days | PR 2 merged |
