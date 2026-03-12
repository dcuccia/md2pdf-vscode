# Changelog

All notable changes to the md2pdf VS Code extension will be documented in this file.

## [0.2.0] — Unreleased

### Changed
- **Pure Node.js architecture** — eliminated Python as a runtime dependency
- **System browser for PDF** — uses puppeteer-core with system Chrome/Edge instead of Playwright + downloaded Chromium
- Markdown→HTML conversion now uses markdown-it (in-process, no subprocess)
- Chart generation now uses TypeScript port of md2svg (in-process, no subprocess)
- Replaced `md2pdf.pythonPath` and `md2pdf.nodePath` settings with `md2pdf.browserPath`
- Updated CI to test on ubuntu/windows/macos × Node.js 18/20/22

### Added
- `md2pdf.browserPath` setting for custom Chrome/Edge path
- Cross-platform browser auto-detection (Windows Edge, macOS/Linux Chrome/Chromium)
- In-process pipeline modules: md2svg, md2html, html2pdf, browser-detect
- CI workflow for pull requests (.github/workflows/ci.yml)
- Cross-repo migration plan (docs/cross-repo-migration-plan.md)

### Removed
- Python runtime dependency
- Playwright dependency (and ~150MB Chromium download)
- `md2pdf.pythonPath` setting
- `md2pdf.nodePath` setting
- Automatic pip/playwright install on first use

## [0.1.0] — Unreleased

### Added
- Right-click context menu for `.md` files: Export as PDF, HTML, or both
- Command palette commands for all export formats
- Configurable theme selection (default, academic, minimal)
- Configurable output directory, image scale
- Path validation and security hardening (no shell injection)
- Integration with [md2pdf](https://github.com/dcuccia/md2pdf) CLI pipeline
