# md2pdf for VS Code

Export Markdown files to styled HTML and PDF directly from VS Code — with support for inline charts, Mermaid diagrams, GitHub-style alerts, math, syntax highlighting, and more.

This extension is a VS Code wrapper around the [md2pdf](https://github.com/dcuccia/md2pdf) CLI tool.

## Features

- **Right-click export** — select any `.md` file in the explorer or editor and choose "Export as PDF", "Export as HTML", or "Export as HTML + PDF"
- **Command palette** — all export commands available via `Ctrl+Shift+P`
- **Theme selection** — choose from default, academic, or minimal themes
- **Full md2pdf pipeline** — charts, Mermaid, alerts, math, syntax highlighting, task lists, page breaks, frontmatter

## Requirements

The extension bundles the [md2pdf](https://github.com/dcuccia/md2pdf) pipeline scripts and themes. You need:

- **Python 3.10+** — for Markdown→HTML conversion and chart generation
- **Node.js 18+** — for HTML→PDF rendering via Playwright

On first export, the extension will automatically install the required Python packages (`markdown`, `pyyaml`) and Node.js packages (`playwright` + Chromium browser). This is a one-time setup.

You can also point the extension at an existing md2pdf installation via the `md2pdf.toolPath` setting.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `md2pdf.toolPath` | `""` | Path to the md2pdf repository root |
| `md2pdf.theme` | `"default"` | CSS theme: `default`, `academic`, or `minimal` |
| `md2pdf.outputDirectory` | `""` | Output directory (defaults to same as source file) |
| `md2pdf.imageScale` | `350` | Image height scale for SVG charts |
| `md2pdf.pythonPath` | `"python"` | Path to Python executable |
| `md2pdf.nodePath` | `"node"` | Path to Node.js executable |

## Security

This extension is designed with security as a priority:

- **No shell injection** — uses `child_process.spawn` with `shell: false`; all arguments passed as arrays, never string-interpolated
- **Path validation** — only processes `.md` files within workspace folders; rejects path traversal attempts
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

- [md2pdf](https://github.com/dcuccia/md2pdf) — the CLI tool this extension wraps

## License

[MIT](LICENSE) — David Cuccia
