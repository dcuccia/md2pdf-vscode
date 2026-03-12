# md2pdf-vscode — Copilot Instructions

## Project Overview

VS Code extension wrapping the [md2pdf](https://github.com/dcuccia/md2pdf) CLI tool.
Provides right-click context menu commands to export Markdown as HTML, PDF, or both.

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point — command registration, UI |
| `src/converter.ts` | Secure subprocess wrapper for md2pdf pipeline |
| `test/converter.test.ts` | Unit tests for path validation and security |
| `package.json` | Extension manifest with commands, menus, settings |

## Security Requirements

- Use `spawn()` with `shell: false` — never `exec()` or `shell: true`
- Pass arguments as arrays — never interpolate into command strings
- Validate paths are within workspace before processing
- No secrets, credentials, or network requests

## Code Style

- TypeScript strict mode, 2-space indent
- JSDoc on exported functions
- Test security invariants explicitly
- Keep extension thin — logic lives in md2pdf CLI, not here
