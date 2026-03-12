/**
 * md2pdf Dependency Manager — Auto-installs Python and Node.js dependencies.
 *
 * On first use (or when dependencies are missing), installs:
 * - Python: markdown, pyyaml (via pip, into user site-packages)
 * - Node.js: playwright (via npm, into the bundled pipeline directory)
 *
 * Security:
 * - Only installs known, hardcoded package names
 * - No user-controlled strings in install commands
 * - Uses shell: true (required on Windows where python/node are .cmd shims)
 *   — safe because all commands and arguments are hardcoded constants
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";

/** Status of a dependency check. */
interface DepStatus {
  python: boolean;
  node: boolean;
  pipPackages: boolean;
  playwright: boolean;
}

export class DependencyManager {
  private pipelineRoot: string;

  constructor(pipelineRoot: string) {
    this.pipelineRoot = pipelineRoot;
  }

  /**
   * Ensure all dependencies are available.
   * Shows progress notification during installation.
   * Returns true if all deps are ready, false if user cancelled or critical failure.
   */
  async ensureDependencies(
    pythonPath: string,
    nodePath: string
  ): Promise<boolean> {
    const status = await this.checkDependencies(pythonPath, nodePath);

    if (status.python && status.node && status.pipPackages && status.playwright) {
      return true;
    }

    if (!status.python) {
      vscode.window.showErrorMessage(
        `md2pdf: Python not found at "${pythonPath}". ` +
        "Install Python 3.10+ or set md2pdf.pythonPath in settings."
      );
      return false;
    }

    if (!status.node) {
      vscode.window.showErrorMessage(
        `md2pdf: Node.js not found at "${nodePath}". ` +
        "Install Node.js 18+ or set md2pdf.nodePath in settings."
      );
      return false;
    }

    // Install missing dependencies with progress
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "md2pdf: Installing dependencies...",
        cancellable: false,
      },
      async (progress) => {
        try {
          if (!status.pipPackages) {
            progress.report({ message: "Installing Python packages..." });
            await this.installPipPackages(pythonPath);
          }

          if (!status.playwright) {
            progress.report({ message: "Installing Playwright..." });
            await this.installPlaywright(nodePath);
          }

          vscode.window.showInformationMessage(
            "md2pdf: Dependencies installed successfully."
          );
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(
            `md2pdf: Failed to install dependencies — ${msg}`
          );
          return false;
        }
      }
    );
  }

  /** Check which dependencies are available. */
  private async checkDependencies(
    pythonPath: string,
    nodePath: string
  ): Promise<DepStatus> {
    const [python, node, pipPackages, playwright] = await Promise.all([
      this.checkCommand(pythonPath, ["--version"]),
      this.checkCommand(nodePath, ["--version"]),
      this.checkPipPackages(pythonPath),
      this.checkPlaywright(),
    ]);

    return { python, node, pipPackages, playwright };
  }

  /** Check if a command is executable. */
  private checkCommand(cmd: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      // shell: true required on Windows where python/node may be .cmd shims
      const child = spawn(cmd, args, { shell: true, stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  }

  /** Check if required pip packages are importable. */
  private checkPipPackages(pythonPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(
        pythonPath,
        ["-c", "import markdown; import yaml"],
        { shell: true, stdio: "ignore" }
      );
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  }

  /** Check if playwright is installed in the pipeline's node_modules. */
  private checkPlaywright(): Promise<boolean> {
    const playwrightDir = path.join(
      this.pipelineRoot,
      "node_modules",
      "playwright"
    );
    return Promise.resolve(fs.existsSync(playwrightDir));
  }

  /** Install Python packages via pip. */
  private installPipPackages(pythonPath: string): Promise<void> {
    return this.runInstall(pythonPath, [
      "-m",
      "pip",
      "install",
      "--user",
      "--quiet",
      "markdown>=3.4",
      "pyyaml>=6.0",
    ]);
  }

  /** Install Playwright via npm + browser download. */
  private async installPlaywright(nodePath: string): Promise<void> {
    // npm/npx are always .cmd on Windows; shell: true handles this
    await this.runInstall("npm", ["install", "--prefix", this.pipelineRoot, "playwright"]);

    await this.runInstall("npx", [
      "--prefix",
      this.pipelineRoot,
      "playwright",
      "install",
      "chromium",
    ]);
  }

  /** Run an install command and reject on failure. */
  private runInstall(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // shell: true required on Windows where commands may be .cmd shims.
      // Safe: all commands and arguments are hardcoded constants.
      const child = spawn(command, args, {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: this.pipelineRoot,
      });

      let stderr = "";
      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (err: Error) => {
        reject(new Error(`Failed to run ${command}: ${err.message}`));
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`${command} ${args[0]} failed (exit ${code}): ${stderr}`)
          );
        }
      });
    });
  }
}
