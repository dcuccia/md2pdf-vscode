/**
 * md2pdf VS Code Extension — Entry point.
 *
 * Registers commands for exporting Markdown files as HTML, PDF, or both
 * via right-click context menus and the command palette.
 */

import * as vscode from "vscode";
import { Converter } from "./converter";

let converter: Converter;

export function activate(context: vscode.ExtensionContext): void {
  converter = new Converter(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("md2pdf.exportPdf", (uri?: vscode.Uri) =>
      exportFile(uri, "pdf")
    ),
    vscode.commands.registerCommand("md2pdf.exportHtml", (uri?: vscode.Uri) =>
      exportFile(uri, "html")
    ),
    vscode.commands.registerCommand("md2pdf.exportBoth", (uri?: vscode.Uri) =>
      exportFile(uri, "both")
    )
  );
}

export function deactivate(): void {
  // Nothing to clean up
}

async function exportFile(
  uri: vscode.Uri | undefined,
  format: "html" | "pdf" | "both"
): Promise<void> {
  const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!fileUri) {
    vscode.window.showWarningMessage("md2pdf: No Markdown file selected.");
    return;
  }

  if (!fileUri.fsPath.endsWith(".md")) {
    vscode.window.showWarningMessage("md2pdf: Selected file is not a Markdown file.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `md2pdf: Exporting ${format.toUpperCase()}...`,
      cancellable: false,
    },
    async () => {
      try {
        const results = await converter.convert(fileUri.fsPath, format);
        const fileList = results.join(", ");
        vscode.window.showInformationMessage(`md2pdf: Created ${fileList}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`md2pdf: Export failed — ${message}`);
      }
    }
  );
}
