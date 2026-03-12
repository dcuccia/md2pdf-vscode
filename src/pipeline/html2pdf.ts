/**
 * html2pdf — Render an HTML file to PDF via puppeteer-core and a system browser.
 *
 * Starts a local HTTP server to serve the HTML and its assets (images, SVGs,
 * CSS), navigates headless Chrome/Edge to the page, waits for Mermaid diagrams
 * to render, and prints to PDF.
 *
 * This module is a port of md2pdf's lib/html2pdf.js from Playwright to
 * puppeteer-core. It will eventually live in the md2pdf core library
 * (dcuccia/md2pdf).
 *
 * Security:
 * - Uses a local HTTP server bound to 127.0.0.1 (loopback only)
 * - The server only serves files from the specified directory
 * - No user-controlled strings reach the browser's address bar
 *
 * Usage:
 *   import { convert } from "./html2pdf";
 *   const size = await convert("/path/to/dir", "file.html", "/path/to/output.pdf");
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Create a static file server rooted at `dir`.
 *
 * Security: Only serves files within the specified directory.
 * Bound to 127.0.0.1 to prevent network access.
 */
function createFileServer(dir: string): http.Server {
  return http.createServer((req, res) => {
    const reqUrl = req.url ?? "/";
    const filePath = path.join(dir, decodeURIComponent(reqUrl.replace(/^\//, "")));

    // Security: ensure resolved path is within the served directory
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(dir))) {
      res.writeHead(403);
      res.end();
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

/** Options for PDF conversion. */
export interface PdfOptions {
  format?: string;
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

/**
 * Convert an HTML file to PDF using a system browser via puppeteer-core.
 *
 * @param dir - Directory containing the HTML and assets
 * @param htmlName - Filename of the HTML file (not full path)
 * @param pdfPath - Full path for the output PDF
 * @param browserPath - Path to the Chrome/Edge executable
 * @param options - Optional PDF settings (format, margins)
 * @returns Size of the generated PDF in bytes
 */
export async function convert(
  dir: string,
  htmlName: string,
  pdfPath: string,
  browserPath: string,
  options: PdfOptions = {}
): Promise<number> {
  const format = options.format ?? "Letter";
  const margin = options.margin ?? {
    top: "0.6in",
    bottom: "0.6in",
    left: "0.75in",
    right: "0.75in",
  };

  const server = createFileServer(dir);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(
      `http://127.0.0.1:${port}/${encodeURIComponent(htmlName)}`,
      { waitUntil: "networkidle0" }
    );

    // Wait for Mermaid diagrams to render (if any)
    // Note: the function string executes in the browser context, not Node.js
    await page
      .waitForFunction(
        `(() => {
          const els = document.querySelectorAll(".mermaid");
          return els.length === 0 || [...els].every(el => el.querySelector("svg"));
        })()`,
        { timeout: 15000 }
      )
      .catch(() => {
        // Timeout is acceptable — proceed without Mermaid
      });

    await page.pdf({
      path: pdfPath,
      format: format as "Letter",
      printBackground: true,
      margin,
    });

    return fs.statSync(pdfPath).size;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}
