# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x | ✅ |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include a description of the issue, reproduction steps, and potential impact

## Security Design

This extension follows these security principles:

### No Shell Injection
- All subprocess calls use `child_process.spawn` with `shell: false`
- Arguments are passed as arrays, never string-interpolated
- The extension never calls `child_process.exec()`

### Path Validation
- Only `.md` files within workspace folders are processed
- Path traversal attempts (e.g., `../../etc/passwd`) are rejected
- All paths are resolved with `path.resolve()` before use

### Minimal Privilege
- No secrets, credentials, or authentication tokens handled
- No network requests made by the extension itself
- CDN references (Mermaid, KaTeX, Highlight.js) are only in generated HTML output
- Subprocess environment inherits from VS Code, no elevation

### Dependency Security
- Dependencies are pinned to major versions in `package.json`
- Only well-established packages used (`@vscode/test-electron`, `typescript`, `eslint`)
- The md2pdf CLI tool dependencies (`markdown`, `playwright`) are managed separately
