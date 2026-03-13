"use strict";
/**
 * Cross-platform system browser detection for PDF rendering.
 *
 * Detects installed Chromium-based browsers (Chrome, Edge, Chromium) on
 * Windows, macOS, and Linux. Returns the first found executable path.
 *
 * Detection priority:
 * 1. User-configured path (md2pdf.browserPath setting)
 * 2. CHROME_PATH / CHROMIUM_PATH environment variables
 * 3. Platform-specific well-known install paths
 *
 * This module is designed to be portable — it will eventually live in the
 * md2pdf core library (dcuccia/md2pdf) and be shared by both the CLI and
 * the VS Code extension.
 *
 * Security: Only checks existence of files at well-known system paths.
 * Does not execute anything or accept user input beyond configuration.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectBrowser = detectBrowser;
exports.getBrowserInstallHint = getBrowserInstallHint;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Well-known browser executable paths by platform. */
const BROWSER_PATHS = {
    win32: [
        // Edge (pre-installed on Windows 10/11)
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        // Chrome
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ],
    darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
    ],
};
/**
 * Detect a system-installed Chromium-based browser.
 *
 * @param configuredPath - User-configured browser path (from settings), or empty string
 * @returns Absolute path to the browser executable, or null if not found
 */
function detectBrowser(configuredPath) {
    // Priority 1: User-configured path
    if (configuredPath && fs.existsSync(configuredPath)) {
        return path.resolve(configuredPath);
    }
    // Priority 2: Environment variables
    for (const envVar of ["CHROME_PATH", "CHROMIUM_PATH"]) {
        const envPath = process.env[envVar];
        if (envPath && fs.existsSync(envPath)) {
            return path.resolve(envPath);
        }
    }
    // Priority 3: Well-known paths for current platform
    const candidates = BROWSER_PATHS[process.platform] ?? [];
    // On Windows, also check user-local Chrome install
    if (process.platform === "win32" && process.env.LOCALAPPDATA) {
        candidates.push(path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"));
    }
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}
/**
 * Get a human-readable install hint for the current platform.
 */
function getBrowserInstallHint() {
    switch (process.platform) {
        case "win32":
            return "Microsoft Edge should be pre-installed. If not, install Chrome from https://google.com/chrome";
        case "darwin":
            return "Install Chrome from https://google.com/chrome or Edge from https://microsoft.com/edge";
        case "linux":
            return "Install Chromium: sudo apt install chromium-browser (Debian/Ubuntu) or sudo dnf install chromium (Fedora)";
        default:
            return "Install Chrome from https://google.com/chrome";
    }
}
