"use strict";
/**
 * md2html — Convert Markdown to styled HTML with a transform pipeline.
 *
 * Reads a Markdown file, applies a CSS theme, and runs a series of transforms
 * to support Mermaid diagrams, GitHub-style alerts, math (KaTeX), syntax
 * highlighting, task lists, and page breaks.
 *
 * Node.js implementation using
 * markdown-it. It is part of the md2pdf core library (dcuccia/md2pdf).
 *
 * Usage:
 *   import { convert } from "./md2html";
 *   const size = convert("input.md", "output.html", "theme.css");
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
exports.parseFrontmatter = parseFrontmatter;
exports.runTransforms = runTransforms;
exports.convert = convert;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const markdown_it_1 = __importDefault(require("markdown-it"));
/**
 * Extract YAML frontmatter from markdown text.
 *
 * Returns [remaining_markdown, frontmatter_dict]. If no frontmatter
 * is found, returns the original text and an empty object.
 */
function parseFrontmatter(mdText) {
    const match = mdText.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match)
        return [mdText, {}];
    try {
        const meta = yaml.load(match[1]);
        if (typeof meta !== "object" || meta === null)
            return [mdText, {}];
        return [mdText.slice(match[0].length), meta];
    }
    catch {
        return [mdText, {}];
    }
}
/** Convert fenced mermaid code blocks to Mermaid-compatible elements. */
function transformMermaid(html) {
    html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, '<pre class="mermaid">$1</pre>');
    const scripts = [];
    if (html.includes('<pre class="mermaid">')) {
        scripts.push('<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>' +
            "<script>mermaid.initialize({startOnLoad:true});</script>");
    }
    return [html, scripts, []];
}
/** GitHub alert types and their default labels/icons. */
const ALERT_TYPES = {
    NOTE: ["ℹ️", "note"],
    TIP: ["💡", "tip"],
    IMPORTANT: ["❗", "important"],
    WARNING: ["⚠️", "warning"],
    CAUTION: ["🔴", "caution"],
};
const ALERT_RE = /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?([\s\S]*?)<\/p>\s*<\/blockquote>/gi;
/** Convert GitHub-style alerts to styled callout divs. */
function transformAlerts(html) {
    html = html.replace(ALERT_RE, (_match, type, body) => {
        const alertType = type.toUpperCase();
        const [icon, cssClass] = ALERT_TYPES[alertType] ?? ["", "note"];
        const title = alertType.charAt(0) + alertType.slice(1).toLowerCase();
        return (`<div class="md2pdf-alert md2pdf-alert-${cssClass}">` +
            `<p class="md2pdf-alert-title">${icon} ${title}</p>` +
            `<p>${body.trim()}</p></div>`);
    });
    return [html, [], []];
}
/** Convert task list markers to HTML checkboxes. */
function transformTaskLists(html) {
    html = html.replace(/<li>\s*\[ \]\s*/g, '<li class="md2pdf-task"><input type="checkbox" disabled> ');
    html = html.replace(/<li>\s*\[x\]\s*/gi, '<li class="md2pdf-task md2pdf-task-done"><input type="checkbox" checked disabled> ');
    return [html, [], []];
}
/** Inject Highlight.js for syntax-highlighted code blocks. */
function transformSyntaxHighlight(html) {
    const scripts = [];
    const styles = [];
    if (/class="language-/.test(html)) {
        styles.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css">');
        scripts.push('<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>' +
            "<script>hljs.highlightAll();</script>");
    }
    return [html, scripts, styles];
}
/** Render LaTeX math expressions via KaTeX. */
function transformMath(html) {
    const scripts = [];
    const styles = [];
    const hasBlockMath = /\$\$[\s\S]*?\$\$/.test(html);
    const hasInlineMath = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/.test(html);
    if (hasBlockMath || hasInlineMath) {
        styles.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">');
        scripts.push('<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"></script>' +
            '<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/contrib/auto-render.min.js"></script>' +
            "<script>document.addEventListener('DOMContentLoaded',function(){" +
            "renderMathInElement(document.body,{delimiters:[" +
            "{left:'$$',right:'$$',display:true}," +
            "{left:'$',right:'$',display:false}" +
            "]})});</script>");
    }
    return [html, scripts, styles];
}
/** Convert <!-- pagebreak --> comments to CSS page breaks. */
function transformPageBreaks(html) {
    html = html.replace(/<!--\s*pagebreak\s*-->/gi, '<div class="md2pdf-pagebreak"></div>');
    return [html, [], []];
}
// ═══════════════════════════════════════════════════════════════════════
// Transform Pipeline
// ═══════════════════════════════════════════════════════════════════════
const TRANSFORMS = [
    transformMermaid,
    transformAlerts,
    transformTaskLists,
    transformSyntaxHighlight,
    transformMath,
    transformPageBreaks,
];
/**
 * Run all transforms on HTML body.
 * Returns [transformed_html, all_scripts, all_styles].
 */
function runTransforms(html) {
    const allScripts = [];
    const allStyles = [];
    for (const transform of TRANSFORMS) {
        const [newHtml, scripts, styles] = transform(html);
        html = newHtml;
        allScripts.push(...scripts);
        allStyles.push(...styles);
    }
    return [html, allScripts, allStyles];
}
// ═══════════════════════════════════════════════════════════════════════
// Conversion
// ═══════════════════════════════════════════════════════════════════════
/**
 * Convert a Markdown file to styled HTML.
 *
 * @param mdPath - Path to the input Markdown file
 * @param htmlPath - Path for the output HTML file
 * @param cssPath - Path to the CSS theme file
 * @param imageScale - Default image height scale for SVG charts (default: 350)
 * @returns Size of the generated HTML file in bytes
 */
function convert(mdPath, htmlPath, cssPath, imageScale = 350) {
    let mdText = fs.readFileSync(mdPath, "utf-8");
    // Extract frontmatter (if present)
    const [remaining, meta] = parseFrontmatter(mdText);
    mdText = remaining;
    // Apply frontmatter overrides
    const scale = meta.image_scale ?? imageScale;
    // Scale images for PDF rendering
    mdText = mdText.replace(/height="300"/g, `height="${scale}"`);
    // Parse Markdown to HTML using markdown-it
    const md = new markdown_it_1.default({
        html: true,
        linkify: true,
        typographer: false,
    });
    const htmlBody = md.render(mdText);
    // Run transform pipeline
    const [transformedBody, scripts, styles] = runTransforms(htmlBody);
    // Load theme CSS
    const css = fs.readFileSync(cssPath, "utf-8");
    // Assemble HTML document
    const headParts = [`<meta charset="utf-8">`, `<style>${css}</style>`];
    headParts.push(...styles);
    headParts.push(...scripts);
    if (meta.title) {
        headParts.push(`<title>${meta.title}</title>`);
    }
    const html = "<!DOCTYPE html><html><head>" +
        headParts.join("") +
        "</head><body>" +
        transformedBody +
        "</body></html>";
    fs.writeFileSync(htmlPath, html, "utf-8");
    return fs.statSync(htmlPath).size;
}
