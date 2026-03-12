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

### Subprocess Execution
- All subprocess calls use `child_process.spawn` (never `exec()`)
- Arguments are passed as arrays, never string-interpolated
- `shell: true` is used because on Windows, `python` and `node` often resolve
  to `.cmd`/`.bat` shims (from pyenv, conda, nvm, etc.), and Node.js throws
  `EINVAL` for batch files when `shell: false` is used (CVE-2024-27980 hardening)
- This is safe because:
  - Command names are hardcoded or from user settings (not arbitrary input)
  - All file path arguments are validated by `validatePath()` (workspace-bounded)
  - Dependency install commands use only hardcoded package names
  - This is the same approach used by VS Code's Python and ESLint extensions

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
