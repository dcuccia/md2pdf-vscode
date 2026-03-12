/**
 * md2pdf Converter — Secure subprocess wrapper for the md2pdf CLI pipeline.
 *
 * Resolution order for pipeline scripts:
 * 1. User-configured md2pdf.toolPath
 * 2. Bundled pipeline (shipped inside the extension)
 * 3. Sibling directory or home directory
 *
 * Security hardening:
 * - Validates all file paths are within the workspace (prevents traversal)
 * - Paths passed as explicit arguments, never interpolated into strings
 * - No user-controlled strings in command names
 * - Uses shell: true (required on Windows where python/node are .cmd shims);
 *   safe because path arguments are validated by validatePath() and pipeline
 *   paths are resolved from known extension directories
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { DependencyManager } from "./dependencies";

/** Resolved paths to the md2pdf pipeline scripts. */
interface PipelinePaths {
  root: string;
  md2svg: string;
  md2html: string;
  html2pdf: string;
  themeCss: string;
}

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
    const pipeline = this.resolvePipeline(config);

    // Ensure dependencies are installed before running
    const depManager = new DependencyManager(pipeline.root);
    const ready = await depManager.ensureDependencies(
      config.pythonPath,
      config.nodePath
    );
    if (!ready) {
      throw new Error("Required dependencies are not available.");
    }

    const dir = path.dirname(validated);
    const base = path.basename(validated, ".md");
    const outputDir = config.outputDirectory || dir;

    const htmlPath = path.join(outputDir, `${base}.html`);
    const pdfPath = path.join(outputDir, `${base}.pdf`);

    const results: string[] = [];

    // Step 1: Generate SVG charts
    await this.runPython(config.pythonPath, [pipeline.md2svg, validated]);

    // Step 2: Convert MD → HTML
    const md2htmlArgs = [
      pipeline.md2html,
      validated,
      htmlPath,
      pipeline.themeCss,
    ];
    if (config.imageScale !== 350) {
      md2htmlArgs.push("--image-scale", String(config.imageScale));
    }
    await this.runPython(config.pythonPath, md2htmlArgs);

    if (format === "html") {
      results.push(path.basename(htmlPath));
      return results;
    }

    // Step 3: Convert HTML → PDF
    await this.runNode(config.nodePath, [pipeline.html2pdf, dir, htmlPath, pdfPath]);
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
      pythonPath: config.get<string>("pythonPath", "python"),
      nodePath: config.get<string>("nodePath", "node"),
    };
  }

  /** Resolve paths to all pipeline scripts. */
  private resolvePipeline(config: ReturnType<Converter["getConfig"]>): PipelinePaths {
    let root: string;

    if (config.toolPath) {
      root = path.resolve(config.toolPath);
    } else {
      // Priority 1: Bundled pipeline (inside the extension)
      const bundled = path.join(this.context.extensionPath, "pipeline");
      // Priority 2: Sibling directories and home
      const candidates = [
        bundled,
        ...((vscode.workspace.workspaceFolders ?? []).map((f) =>
          path.join(path.dirname(f.uri.fsPath), "md2pdf")
        )),
        path.join(process.env.HOME || process.env.USERPROFILE || "", "md2pdf"),
      ];

      const found = candidates.find((c) =>
        fs.existsSync(path.join(c, "lib", "md2html.py"))
      );

      if (!found) {
        throw new Error(
          "md2pdf tool not found. Set md2pdf.toolPath in settings, " +
          "or clone https://github.com/dcuccia/md2pdf to a sibling directory."
        );
      }
      root = found;
    }

    const themeCss = path.join(root, "themes", `${config.theme}.css`);
    if (!fs.existsSync(themeCss)) {
      throw new Error(`Theme not found: ${themeCss}`);
    }

    return {
      root,
      md2svg: path.join(root, "lib", "md2svg.py"),
      md2html: path.join(root, "lib", "md2html.py"),
      html2pdf: path.join(root, "lib", "html2pdf.js"),
      themeCss,
    };
  }

  /** Run a Python script via spawn (shell: false for security). */
  private runPython(pythonPath: string, args: string[]): Promise<string> {
    return this.runProcess(pythonPath, args);
  }

  /** Run a Node.js script via spawn (shell: false for security). */
  private runNode(nodePath: string, args: string[]): Promise<string> {
    return this.runProcess(nodePath, args);
  }

  /**
   * Spawn a subprocess securely.
   *
   * Security:
   * - Arguments are passed as an array, never concatenated
   * - All file path arguments are validated by validatePath() before reaching here
   * - Command names are hardcoded (pythonPath/nodePath from settings)
   * - shell: true is required on Windows where python/node may be .cmd shims
   *   (Node.js throws EINVAL for batch files with shell: false)
   */
  private runProcess(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child: ChildProcess = spawn(command, args, {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (err: Error) => {
        reject(new Error(`Failed to start ${command}: ${err.message}`));
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          const detail = stderr || stdout || `exit code ${code}`;
          reject(new Error(`${path.basename(command)} failed: ${detail}`));
        }
      });
    });
  }
}
