/**
 * md2pdf Dependency Manager — Validates system browser availability.
 *
 * The pure Node.js pipeline requires only a system-installed Chromium-based
 * browser (Chrome, Edge, or Chromium) for PDF generation. HTML-only export
 * works without any browser.
 *
 * Security:
 * - Only checks file existence at well-known system paths
 * - No subprocess spawning or command execution
 * - No user-controlled strings in any checks
 */

import * as vscode from "vscode";
import { detectBrowser, getBrowserInstallHint } from "./pipeline";

export class DependencyManager {
  /**
   * Check if a system browser is available for PDF rendering.
   *
   * Shows a warning if no browser is found but returns true — HTML export
   * still works without a browser. Only PDF export requires a browser.
   *
   * @param browserPath - User-configured browser path (from settings)
   * @returns true (always — browser is only needed for PDF, not HTML)
   */
  async checkBrowser(browserPath: string): Promise<boolean> {
    const browser = detectBrowser(browserPath);
    if (!browser) {
      const hint = getBrowserInstallHint();
      vscode.window.showWarningMessage(
        `md2pdf: No Chrome/Edge browser detected. PDF export requires a Chromium-based browser. ${hint} ` +
        "Or set md2pdf.browserPath in settings. HTML export will still work."
      );
      return false;
    }
    return true;
  }
}
