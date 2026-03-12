# md2pdf for VS Code

Export Markdown files to styled HTML and PDF directly from VS Code — with support for inline charts, Mermaid diagrams, GitHub-style alerts, math, syntax highlighting, and more.

Built on a pure Node.js pipeline with zero Python dependencies. Uses your system's Chrome or Edge browser for PDF rendering — no Playwright or Chromium download required.

## Features

- **Right-click export** — select any `.md` file in the explorer or editor and choose "Export as PDF", "Export as HTML", or "Export as HTML + PDF"
- **Command palette** — all export commands available via `Ctrl+Shift+P`
- **Theme selection** — choose from default, academic, or minimal themes
- **Full md2pdf pipeline** — charts, Mermaid, alerts, math, syntax highlighting, task lists, page breaks, frontmatter
- **Zero-config PDF** — auto-detects system Chrome/Edge for PDF rendering
- **Near-zero install footprint** — no Python, no Playwright download, no 150MB Chromium

## Requirements

- **Node.js 18+** — powers the Markdown→HTML conversion and chart generation
- **Chrome, Edge, or Chromium** — for HTML→PDF rendering (auto-detected)
  - **Windows**: Edge is pre-installed on Windows 10/11 ✅
  - **macOS**: Install Chrome from [google.com/chrome](https://google.com/chrome)
  - **Linux**: `sudo apt install chromium-browser` (or equivalent)

HTML export works without any browser installed. PDF export requires a Chromium-based browser.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `md2pdf.toolPath` | `""` | Path to the md2pdf repository root (for theme overrides) |
| `md2pdf.theme` | `"default"` | CSS theme: `default`, `academic`, or `minimal` |
| `md2pdf.outputDirectory` | `""` | Output directory (defaults to same as source file) |
| `md2pdf.imageScale` | `350` | Image height scale for SVG charts |
| `md2pdf.browserPath` | `""` | Path to Chrome/Edge executable (auto-detected if empty) |

## Architecture

```
document.md
  ├──→ md2svg    (Node.js)  → *.svg charts from @chart YAML blocks
  ├──→ md2html   (Node.js)  → styled HTML via markdown-it + transforms
  └──→ html2pdf  (Node.js)  → PDF via puppeteer-core + system Chrome/Edge
```

All pipeline stages run in-process — no subprocess spawning, no Python.

## Security

This extension is designed with security as a priority:

- **No shell injection** — no use of `child_process.exec` or `shell: true`
- **Path validation** — only processes `.md` files within workspace folders; rejects path traversal attempts
- **Localhost-only server** — the HTML→PDF file server binds to `127.0.0.1` with directory traversal protection
- **No network access** — all processing is local; CDN resources are referenced in the generated HTML only
- **Minimal permissions** — no secrets, credentials, or sensitive data handled

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests (requires VS Code)
npm test

# Package as .vsix
npx @vscode/vsce package
```

## Related

- [md2pdf](https://github.com/dcuccia/md2pdf) — the core pipeline library (themes, chart conventions, CLI)

## License

[MIT](LICENSE) — David Cuccia
