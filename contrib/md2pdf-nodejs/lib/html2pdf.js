"use strict";
/**
 * html2pdf — Render an HTML file to PDF via puppeteer-core and a system browser.
 *
 * Starts a local HTTP server to serve the HTML and its assets (images, SVGs,
 * CSS), navigates headless Chrome/Edge to the page, waits for Mermaid diagrams
 * to render, and prints to PDF.
 *
 * HTML to PDF conversion using
 * puppeteer-core. It is part of the md2pdf core library
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convert = convert;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const MIME_TYPES = {
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
function createFileServer(dir) {
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
async function convert(dir, htmlName, pdfPath, browserPath, options = {}) {
    const format = options.format ?? "Letter";
    const margin = options.margin ?? {
        top: "0.6in",
        bottom: "0.6in",
        left: "0.75in",
        right: "0.75in",
    };
    const server = createFileServer(dir);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;
    let browser;
    try {
        browser = await puppeteer_core_1.default.launch({
            executablePath: browserPath,
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${port}/${encodeURIComponent(htmlName)}`, { waitUntil: "networkidle0" });
        // Wait for Mermaid diagrams to render (if any)
        // Note: the function string executes in the browser context, not Node.js
        await page
            .waitForFunction(`(() => {
          const els = document.querySelectorAll(".mermaid");
          return els.length === 0 || [...els].every(el => el.querySelector("svg"));
        })()`, { timeout: 15000 })
            .catch(() => {
            // Timeout is acceptable — proceed without Mermaid
        });
        await page.pdf({
            path: pdfPath,
            format: format,
            printBackground: true,
            margin,
        });
        return fs.statSync(pdfPath).size;
    }
    finally {
        if (browser)
            await browser.close();
        server.close();
    }
}
