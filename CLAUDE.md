# CLAUDE.md — Project context for Claude Code

## What is this project?

md2pdf-vscode is a VS Code extension that exports Markdown files as HTML, PDF,
or both. It uses a pure Node.js pipeline (markdown-it, puppeteer-core) with
system Chrome/Edge for PDF rendering — no Python or Playwright download required.

The extension shares conventions (themes, @chart syntax, frontmatter) with the
[md2pdf](https://github.com/dcuccia/md2pdf) CLI tool.

## Quick Reference

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Lint
npm run lint

# Run tests
npm test
```

## Architecture

```
User right-clicks .md file
  → VS Code command
    → Converter.convert()
      → md2svg (in-process)      — @chart YAML → SVG files
      → md2html (in-process)     — Markdown → styled HTML via markdown-it
      → html2pdf (in-process)    — HTML → PDF via puppeteer-core + system Chrome/Edge
    → Show success/error notification
```

## Key Files

- `src/extension.ts` — Entry point. Registers commands, handles UI.
- `src/converter.ts` — Orchestrates the in-process Node.js pipeline.
- `src/dependencies.ts` — Validates system browser availability.
- `src/pipeline/` — Node.js pipeline modules:
  - `md2svg.ts` — @chart YAML → SVG chart generation
  - `md2html.ts` — Markdown → HTML via markdown-it + transforms
  - `html2pdf.ts` — HTML → PDF via puppeteer-core + system browser
  - `browser-detect.ts` — Cross-platform Chrome/Edge/Chromium detection
  - `index.ts` — Barrel exports
- `scripts/bundle-pipeline.js` — Copies theme CSS from md2pdf repo.
- `test/converter.test.ts` — Unit tests for pipeline, security, and config.
- `package.json` — Extension manifest with commands, menus, configuration.

## Security Rules (CRITICAL)

- **NEVER** use `exec()` or `shell: true` — no shell injection vectors
- **ALWAYS** validate file paths are within workspace before processing
- **ALWAYS** bind local servers to `127.0.0.1` with directory traversal checks
- **NEVER** handle secrets, credentials, or authentication tokens
- **NEVER** make network requests from the extension itself

## Conventions

- TypeScript strict mode, 2-space indent
- JSDoc on exported functions
- Pipeline modules in `src/pipeline/` follow the md2pdf convention interfaces
- Test security invariants explicitly (see `test/converter.test.ts`)
- Keep theme CSS in the md2pdf repo — bundle via `bundle-pipeline.js`

## Related Projects

- Core library: https://github.com/dcuccia/md2pdf
- Cross-repo plan: `docs/cross-repo-migration-plan.md`
