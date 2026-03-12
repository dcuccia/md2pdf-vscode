# CLAUDE.md — Project context for Claude Code

## What is this project?

md2pdf-vscode is a VS Code extension that wraps the [md2pdf](https://github.com/dcuccia/md2pdf)
CLI tool. It provides right-click context menu commands to export Markdown files as HTML, PDF,
or both.

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
      → spawn python lib/md2svg.py   (chart generation)
      → spawn python lib/md2html.py  (MD → HTML)
      → spawn node lib/html2pdf.js   (HTML → PDF)
    → Show success/error notification
```

## Key Files

- `src/extension.ts` — Entry point. Registers commands, handles UI.
- `src/converter.ts` — Subprocess wrapper. Runs md2pdf pipeline securely.
- `src/dependencies.ts` — Auto-installs Python/Node.js deps on first use.
- `scripts/bundle-pipeline.js` — Copies md2pdf lib/ and themes/ into extension.
- `test/converter.test.ts` — Unit tests for path validation and security.
- `package.json` — Extension manifest with commands, menus, configuration.

## Security Rules (CRITICAL)

- **ALWAYS** use `spawn()` with `shell: false` — NEVER use `exec()` or `shell: true`
- **ALWAYS** pass arguments as arrays — NEVER interpolate user strings into commands
- **ALWAYS** validate file paths are within workspace before processing
- **NEVER** handle secrets, credentials, or authentication tokens
- **NEVER** make network requests from the extension itself

## Conventions

- TypeScript strict mode, 2-space indent
- JSDoc on exported functions
- Follow existing code patterns in `src/converter.ts` for subprocess calls
- Test security invariants explicitly (see `test/converter.test.ts`)
- Keep the extension thin — business logic lives in md2pdf, not here

## Related Project

The CLI tool this wraps: https://github.com/dcuccia/md2pdf
