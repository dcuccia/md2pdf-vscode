"use strict";
/**
 * md2svg — Extract YAML @chart blocks from Markdown and generate SVG files.
 *
 * Scans a Markdown file for fenced ```yaml blocks whose first line is a
 * `# @chart → filename.svg` comment. Parses the YAML data and dispatches
 * to the appropriate chart generator.
 *
 * Also scans for HTML-comment-tagged pipe tables:
 *     <!-- @chart: type → filename.svg -->
 *     | Col1 | Col2 |
 *     |------|------|
 *     | a    | 1    |
 *
 * Supported chart types: bar, hbar, pie, sunburst
 *
 * Node.js implementation for SVG chart generation.
 * It is part of the md2pdf core library (dcuccia/md2pdf).
 *
 * Usage (standalone):
 *   import { generateCharts } from "./md2svg";
 *   const files = await generateCharts("/path/to/document.md");
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
exports.scanCharts = scanCharts;
exports.generateCharts = generateCharts;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
// ═══════════════════════════════════════════════════════════════════════
// SVG Primitives
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_FONT = "Segoe UI, Helvetica, Arial, sans-serif";
/** Qualitative palette (color-blind friendly, based on Tableau 10). */
const PALETTE = [
    "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
    "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
];
/** Escape text for SVG XML. */
function esc(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/** Convert polar to cartesian. 0° = 12 o'clock, clockwise. */
function polarToCart(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
/** SVG path for an annular sector. */
function arcPath(cx, cy, rIn, rOut, start, end) {
    const sweep = end - start;
    const large = sweep > 180 ? 1 : 0;
    const [ox1, oy1] = polarToCart(cx, cy, rOut, start);
    const [ox2, oy2] = polarToCart(cx, cy, rOut, end);
    const [ix1, iy1] = polarToCart(cx, cy, rIn, end);
    const [ix2, iy2] = polarToCart(cx, cy, rIn, start);
    if (rIn < 1) {
        return `M ${cx.toFixed(1)},${cy.toFixed(1)} L ${ox1.toFixed(1)},${oy1.toFixed(1)} ` +
            `A ${rOut.toFixed(1)},${rOut.toFixed(1)} 0 ${large},1 ${ox2.toFixed(1)},${oy2.toFixed(1)} Z`;
    }
    return `M ${ox1.toFixed(1)},${oy1.toFixed(1)} ` +
        `A ${rOut.toFixed(1)},${rOut.toFixed(1)} 0 ${large},1 ${ox2.toFixed(1)},${oy2.toFixed(1)} ` +
        `L ${ix1.toFixed(1)},${iy1.toFixed(1)} ` +
        `A ${rIn.toFixed(1)},${rIn.toFixed(1)} 0 ${large},0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z`;
}
function arcLabelPos(cx, cy, r, start, end) {
    const mid = (start + end) / 2;
    return polarToCart(cx, cy, r, mid);
}
// ═══════════════════════════════════════════════════════════════════════
// Chart Generators
// ═══════════════════════════════════════════════════════════════════════
/** Vertical bar chart from flat key:value data. */
function generateBar(spec) {
    const title = spec.title ?? "";
    const data = spec.data ?? {};
    const items = Object.entries(data);
    if (items.length === 0)
        return "";
    const n = items.length;
    const maxVal = Math.max(...items.map(([, v]) => v));
    const W = 600, H = 400;
    const marginL = 70, marginR = 30, marginT = 60, marginB = 60;
    const chartW = W - marginL - marginR;
    const chartH = H - marginT - marginB;
    const barW = (chartW / n) * 0.65;
    const gap = chartW / n;
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
        `<rect width="${W}" height="${H}" fill="white"/>`,
    ];
    if (title) {
        parts.push(`<text x="${W / 2}" y="35" text-anchor="middle" font-size="16" ` +
            `font-weight="700" fill="#333" font-family="${DEFAULT_FONT}">${esc(title)}</text>`);
    }
    // Y-axis gridlines
    for (let i = 0; i < 5; i++) {
        const y = marginT + chartH - (i / 4) * chartH;
        const val = (maxVal * i) / 4;
        parts.push(`<line x1="${marginL}" y1="${y.toFixed(0)}" x2="${W - marginR}" y2="${y.toFixed(0)}" ` +
            `stroke="#E0E0E0" stroke-width="0.5"/>`);
        parts.push(`<text x="${marginL - 8}" y="${(y + 4).toFixed(0)}" text-anchor="end" font-size="10" ` +
            `fill="#666" font-family="${DEFAULT_FONT}">${val % 1 === 0 ? val : val.toFixed(1)}</text>`);
    }
    // Bars
    for (let i = 0; i < n; i++) {
        const [label, val] = items[i];
        const x = marginL + i * gap + (gap - barW) / 2;
        const barH = maxVal ? (val / maxVal) * chartH : 0;
        const y = marginT + chartH - barH;
        const color = PALETTE[i % PALETTE.length];
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" ` +
            `rx="3" fill="${color}" opacity="0.85"/>`);
        parts.push(`<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" ` +
            `font-size="10" font-weight="600" fill="#333" font-family="${DEFAULT_FONT}">${val}</text>`);
        parts.push(`<text x="${(x + barW / 2).toFixed(1)}" y="${(marginT + chartH + 18).toFixed(0)}" text-anchor="middle" ` +
            `font-size="10" fill="#444" font-family="${DEFAULT_FONT}">${esc(label)}</text>`);
    }
    parts.push("</svg>");
    return parts.join("\n");
}
/** Horizontal bar chart from flat key:value data. */
function generateHbar(spec) {
    const title = spec.title ?? "";
    const data = spec.data ?? {};
    const items = Object.entries(data);
    if (items.length === 0)
        return "";
    const n = items.length;
    const maxVal = Math.max(...items.map(([, v]) => v));
    const labelW = 120;
    const W = 600;
    const marginR = 30, marginT = 60;
    const barHUnit = 28;
    const gap = 36;
    const chartH = n * gap;
    const H = marginT + chartH + 40;
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
        `<rect width="${W}" height="${H}" fill="white"/>`,
    ];
    if (title) {
        parts.push(`<text x="${W / 2}" y="35" text-anchor="middle" font-size="16" ` +
            `font-weight="700" fill="#333" font-family="${DEFAULT_FONT}">${esc(title)}</text>`);
    }
    const chartW = W - labelW - marginR;
    for (let i = 0; i < n; i++) {
        const [label, val] = items[i];
        const y = marginT + i * gap;
        const barWPx = maxVal ? (val / maxVal) * chartW : 0;
        const color = PALETTE[i % PALETTE.length];
        parts.push(`<text x="${labelW - 8}" y="${(y + barHUnit / 2 + 4).toFixed(0)}" text-anchor="end" ` +
            `font-size="11" fill="#444" font-family="${DEFAULT_FONT}">${esc(label)}</text>`);
        parts.push(`<rect x="${labelW}" y="${y.toFixed(0)}" width="${barWPx.toFixed(1)}" height="${barHUnit}" ` +
            `rx="3" fill="${color}" opacity="0.85"/>`);
        parts.push(`<text x="${(labelW + barWPx + 6).toFixed(1)}" y="${(y + barHUnit / 2 + 4).toFixed(0)}" ` +
            `font-size="10" font-weight="600" fill="#333" font-family="${DEFAULT_FONT}">${val}</text>`);
    }
    parts.push("</svg>");
    return parts.join("\n");
}
/** Pie/donut chart from flat key:value data. */
function generatePie(spec) {
    const title = spec.title ?? "";
    const data = spec.data ?? {};
    const donut = spec.donut ?? false;
    const items = Object.entries(data);
    if (items.length === 0)
        return "";
    const total = items.reduce((sum, [, v]) => sum + v, 0);
    const W = 500, H = 400;
    const cx = 200, cy = 220;
    const rOut = 140;
    const rIn = donut ? 70 : 0;
    const gapAngle = 0.8;
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
        `<rect width="${W}" height="${H}" fill="white"/>`,
    ];
    if (title) {
        parts.push(`<text x="${W / 2}" y="35" text-anchor="middle" font-size="16" ` +
            `font-weight="700" fill="#333" font-family="${DEFAULT_FONT}">${esc(title)}</text>`);
    }
    let angle = 0;
    const legendY = 80;
    for (let i = 0; i < items.length; i++) {
        const [label, val] = items[i];
        const sweep = total ? (val / total) * 360 : 0;
        const s = angle + gapAngle / 2;
        const e = angle + sweep - gapAngle / 2;
        const color = PALETTE[i % PALETTE.length];
        if (e > s) {
            parts.push(`<path d="${arcPath(cx, cy, rIn, rOut, s, e)}" ` +
                `fill="${color}" stroke="white" stroke-width="1.5" opacity="0.9"/>`);
            if (sweep > 18) {
                const [lx, ly] = arcLabelPos(cx, cy, (rIn + rOut) / 2, s, e);
                const pct = (val / total) * 100;
                parts.push(`<text x="${lx.toFixed(0)}" y="${ly.toFixed(0)}" text-anchor="middle" ` +
                    `dominant-baseline="central" font-size="10" font-weight="600" ` +
                    `fill="white" font-family="${DEFAULT_FONT}">${pct.toFixed(0)}%</text>`);
            }
        }
        // Legend
        const ly = legendY + i * 22;
        const pct = total ? (val / total) * 100 : 0;
        parts.push(`<rect x="380" y="${ly}" width="14" height="14" rx="2" fill="${color}"/>`);
        parts.push(`<text x="400" y="${ly + 11}" font-size="10" fill="#444" ` +
            `font-family="${DEFAULT_FONT}">${esc(label)} (${pct.toFixed(0)}%)</text>`);
        angle += sweep;
    }
    parts.push("</svg>");
    return parts.join("\n");
}
/** Recursively render sunburst rings. */
function sunburstRecursive(parts, cx, cy, data, total, startAngle, sweepTotal, ring, ringRadii, gapAngle, depthLimit) {
    if (ring >= ringRadii.length || ring >= depthLimit)
        return;
    const [rIn, rOut] = ringRadii[ring];
    let angle = startAngle;
    const entries = Object.entries(data);
    for (let i = 0; i < entries.length; i++) {
        const [label, node] = entries[i];
        const val = getNodeValue(node);
        const sweep = total ? (val / total) * sweepTotal : 0;
        const s = angle + gapAngle / 2;
        const e = angle + sweep - gapAngle / 2;
        const color = PALETTE[(ring * 5 + i) % PALETTE.length];
        const opacity = Math.max(0.6, 0.95 - ring * 0.1);
        if (e > s) {
            parts.push(`<path d="${arcPath(cx, cy, rIn, rOut, s, e)}" ` +
                `fill="${color}" stroke="white" stroke-width="1" opacity="${opacity}"/>`);
            if (sweep > 12) {
                const [lx, ly] = arcLabelPos(cx, cy, (rIn + rOut) / 2, s, e);
                const fs = Math.max(8, 12 - ring * 2);
                parts.push(`<text x="${lx.toFixed(0)}" y="${ly.toFixed(0)}" text-anchor="middle" ` +
                    `dominant-baseline="central" font-size="${fs}" font-weight="600" ` +
                    `fill="white" font-family="${DEFAULT_FONT}">${esc(String(label))}</text>`);
            }
        }
        // Recurse into children
        if (typeof node === "object" && node !== null) {
            sunburstRecursive(parts, cx, cy, node, val, angle, sweep, ring + 1, ringRadii, gapAngle, depthLimit);
        }
        angle += sweep;
    }
}
/** Get the numeric value of a node (leaf or sum of children). */
function getNodeValue(node) {
    if (typeof node === "number")
        return node;
    if (typeof node === "object" && node !== null) {
        return Object.values(node).reduce((sum, v) => sum + getNodeValue(v), 0);
    }
    return 0;
}
/** Compute max depth of nested data. */
function getDepth(data) {
    if (typeof data !== "object" || data === null)
        return 0;
    return 1 + Math.max(0, ...Object.values(data).map(getDepth));
}
/** Sunburst chart from nested key:value data. */
function generateSunburst(spec) {
    const title = spec.title ?? "";
    const data = (spec.data ?? {});
    if (Object.keys(data).length === 0)
        return "";
    const maxD = Math.min(getDepth(data), 5);
    const W = 600, H = 500;
    const cx = 260, cy = 270;
    const ringRadii = [];
    let r = 0;
    for (let i = 0; i < maxD; i++) {
        const rIn = r;
        const rOut = r + Math.max(50, 100 - i * 15);
        ringRadii.push([rIn, rOut]);
        r = rOut + 5;
    }
    const total = Object.values(data).reduce((sum, v) => sum + getNodeValue(v), 0);
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
        `<rect width="${W}" height="${H}" fill="white"/>`,
    ];
    if (title) {
        parts.push(`<text x="${W / 2}" y="35" text-anchor="middle" font-size="16" ` +
            `font-weight="700" fill="#333" font-family="${DEFAULT_FONT}">${esc(title)}</text>`);
    }
    sunburstRecursive(parts, cx, cy, data, total, 0, 360, 0, ringRadii, 0.8, maxD);
    // Legend (top-level items)
    const legendX = W - 130;
    const legendBaseY = 70;
    const entries = Object.entries(data);
    for (let i = 0; i < entries.length; i++) {
        const [label] = entries[i];
        const ly = legendBaseY + i * 22;
        const color = PALETTE[i % PALETTE.length];
        const val = getNodeValue(entries[i][1]);
        const pct = total ? (val / total) * 100 : 0;
        parts.push(`<rect x="${legendX}" y="${ly}" width="14" height="14" rx="2" fill="${color}"/>`);
        parts.push(`<text x="${legendX + 20}" y="${ly + 11}" font-size="10" fill="#444" ` +
            `font-family="${DEFAULT_FONT}">${esc(String(label))} (${pct.toFixed(0)}%)</text>`);
    }
    parts.push("</svg>");
    return parts.join("\n");
}
// ═══════════════════════════════════════════════════════════════════════
// Chart Dispatcher
// ═══════════════════════════════════════════════════════════════════════
const CHART_GENERATORS = {
    bar: generateBar,
    hbar: generateHbar,
    pie: generatePie,
    donut: (spec) => generatePie({ ...spec, donut: true }),
    sunburst: generateSunburst,
};
// ═══════════════════════════════════════════════════════════════════════
// Markdown Scanner
// ═══════════════════════════════════════════════════════════════════════
/** Pattern: ```yaml block starting with # @chart → filename.svg */
const YAML_CHART_RE = /^```ya?ml\s*\n\s*#\s*@chart\s*→\s*([^\n]+\.svg)\s*\n(.*?)^```\s*$/gms;
/** Pattern: <!-- @chart: type → filename.svg --> followed by a pipe table */
const TABLE_CHART_RE = /<!--\s*@chart:\s*(\w+)\s*→\s*(.+\.svg)\s*-->\s*\n((?:\|.+\|\s*\n)+)/gs;
/** Parse a pipe table into {col1_val: col2_val} dict. */
function parsePipeTable(tableText) {
    const lines = tableText.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 3)
        return {};
    const data = {};
    // Skip header row and separator row
    for (const line of lines.slice(2)) {
        const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
            const num = parseFloat(cells[1]);
            if (!isNaN(num)) {
                data[cells[0]] = num;
            }
        }
    }
    return data;
}
/**
 * Scan markdown text for @chart blocks. Returns list of chart specs.
 */
function scanCharts(mdText) {
    const specs = [];
    // Strip content inside 4+ backtick fences to avoid matching nested examples
    const stripped = mdText.replace(/^[`]{4,}.*?^[`]{4,}/gms, "");
    // YAML fenced blocks
    for (const m of stripped.matchAll(YAML_CHART_RE)) {
        const filename = m[1].trim();
        const yamlBody = m[2];
        try {
            const parsed = yaml.load(yamlBody);
            if (typeof parsed !== "object" || parsed === null)
                continue;
            specs.push({ ...parsed, _filename: filename });
        }
        catch {
            // Skip YAML parse errors
            continue;
        }
    }
    // HTML comment + pipe table (strip ALL code fences first)
    const noFences = stripped.replace(/^```.*?^```/gms, "");
    for (const m of noFences.matchAll(TABLE_CHART_RE)) {
        const chartType = m[1].trim();
        const filename = m[2].trim();
        const tableText = m[3];
        const data = parsePipeTable(tableText);
        if (Object.keys(data).length > 0) {
            specs.push({ type: chartType, data, _filename: filename });
        }
    }
    return specs;
}
/**
 * Scan a .md file and generate SVG files.
 *
 * @param mdPath - Path to the Markdown file
 * @returns List of generated SVG filenames (relative to the .md file)
 */
function generateCharts(mdPath) {
    const mdText = fs.readFileSync(mdPath, "utf-8");
    const specs = scanCharts(mdText);
    if (specs.length === 0)
        return [];
    const outputDir = path.dirname(mdPath);
    const generated = [];
    for (const spec of specs) {
        const filename = spec._filename;
        const chartType = spec.type ?? "bar";
        const genFn = CHART_GENERATORS[chartType];
        if (!genFn)
            continue;
        const svg = genFn(spec);
        if (!svg)
            continue;
        const outPath = path.join(outputDir, filename);
        // Ensure output subdirectory exists
        const outDir = path.dirname(outPath);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(outPath, svg, "utf-8");
        generated.push(filename);
    }
    return generated;
}
