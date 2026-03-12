/**
 * md2pdf Converter — Pure Node.js pipeline for Markdown → HTML/PDF conversion.
 *
 * Runs the conversion pipeline entirely in-process using Node.js modules:
 * - md2svg: Generates SVG charts from @chart blocks
 * - md2html: Converts Markdown to styled HTML via markdown-it
 * - html2pdf: Renders HTML to PDF via puppeteer-core + system browser
 *
 * Theme resolution order:
 * 1. User-configured md2pdf.toolPath/themes/
 * 2. Bundled themes (shipped inside the extension)
 *
 * Security hardening:
 * - Validates all file paths are within the workspace
 * - HTML → PDF uses puppeteer-core with system browser (no downloaded binary)
 * - Local HTTP server bound to 127.0.0.1 only
 * - No user-controlled strings in shell commands
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  generateCharts,
  convertMdToHtml,
  convertHtmlToPdf,
  detectBrowser,
  getBrowserInstallHint,
} from "./pipeline";

export class Converter {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Convert a Markdown file to HTML, PDF, or both.
   * Returns an array of generated file names (basenames only).
   */
  async convert(
    mdPath: string,
    format: "html" | "pdf" | "both"
  ): Promise<string[]> {
    const validated = this.validatePath(mdPath);
    const config = this.getConfig();
    const themeCss = this.resolveTheme(config);

    const dir = path.dirname(validated);
    const base = path.basename(validated, ".md");
    const outputDir = config.outputDirectory || dir;

    const htmlPath = path.join(outputDir, `${base}.html`);
    const pdfPath = path.join(outputDir, `${base}.pdf`);

    const results: string[] = [];

    // Step 1: Generate SVG charts (in-process, no subprocess)
    generateCharts(validated);

    // Step 2: Convert MD → HTML (in-process via markdown-it)
    convertMdToHtml(validated, htmlPath, themeCss, config.imageScale);

    if (format === "html") {
      results.push(path.basename(htmlPath));
      return results;
    }

    // Step 3: Convert HTML → PDF (puppeteer-core + system browser)
    const browserPath = detectBrowser(config.browserPath);
    if (!browserPath) {
      throw new Error(
        `No Chrome/Edge browser found. ${getBrowserInstallHint()} ` +
        "Or set md2pdf.browserPath in settings."
      );
    }

    await convertHtmlToPdf(dir, path.basename(htmlPath), pdfPath, browserPath);
    results.push(path.basename(pdfPath));

    if (format === "both") {
      results.push(path.basename(htmlPath));
    } else {
      // PDF-only: clean up intermediate HTML
      try {
        fs.unlinkSync(htmlPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    return results;
  }

  /**
   * Validate that a file path is safe to process.
   *
   * Security: Prevents path traversal attacks by ensuring the resolved
   * path is within a workspace folder.
   */
  validatePath(filePath: string): string {
    const resolved = path.resolve(filePath);

    // Must exist
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }

    // Must be a .md file
    if (!resolved.endsWith(".md")) {
      throw new Error(`Not a Markdown file: ${resolved}`);
    }

    // Must be within a workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      const isInWorkspace = workspaceFolders.some((folder) => {
        const wsRoot = folder.uri.fsPath;
        return (
          resolved.startsWith(wsRoot + path.sep) || resolved === wsRoot
        );
      });
      if (!isInWorkspace) {
        throw new Error(
          "File is outside the workspace. md2pdf only processes files within workspace folders."
        );
      }
    }

    return resolved;
  }

  /** Read extension configuration. */
  private getConfig() {
    const config = vscode.workspace.getConfiguration("md2pdf");
    return {
      toolPath: config.get<string>("toolPath", ""),
      theme: config.get<string>("theme", "default"),
      outputDirectory: config.get<string>("outputDirectory", ""),
      imageScale: config.get<number>("imageScale", 350),
      browserPath: config.get<string>("browserPath", ""),
    };
  }

  /** Resolve the CSS theme file path. */
  private resolveTheme(config: ReturnType<Converter["getConfig"]>): string {
    const themeFile = `${config.theme}.css`;

    // Priority 1: User-configured tool path
    if (config.toolPath) {
      const themeCss = path.join(path.resolve(config.toolPath), "themes", themeFile);
      if (fs.existsSync(themeCss)) return themeCss;
    }

    // Priority 2: Bundled themes (inside the extension)
    const bundled = path.join(this.context.extensionPath, "pipeline", "themes", themeFile);
    if (fs.existsSync(bundled)) return bundled;

    // Priority 3: Sibling md2pdf directory
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const sibling = path.join(path.dirname(folder.uri.fsPath), "md2pdf", "themes", themeFile);
      if (fs.existsSync(sibling)) return sibling;
    }

    throw new Error(
      `Theme "${config.theme}" not found. ` +
      "Set md2pdf.toolPath in settings or ensure themes are bundled with the extension."
    );
  }
}
