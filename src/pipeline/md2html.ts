/**
 * md2html — Convert Markdown to styled HTML with a transform pipeline.
 *
 * Reads a Markdown file, applies a CSS theme, and runs a series of transforms
 * to support Mermaid diagrams, GitHub-style alerts, math (KaTeX), syntax
 * highlighting, task lists, and page breaks.
 *
 * This module is a port of md2pdf's lib/md2html.py to TypeScript using
 * markdown-it. It will eventually live in the md2pdf core library (dcuccia/md2pdf).
 *
 * Usage:
 *   import { convert } from "./md2html";
 *   const size = convert("input.md", "output.html", "theme.css");
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import MarkdownIt from "markdown-it";

// ═══════════════════════════════════════════════════════════════════════
// Frontmatter
// ═══════════════════════════════════════════════════════════════════════

const FRONTMATTER_RE = /\A---\s*\n(.*?)\n---\s*\n/s;

/** Frontmatter metadata parsed from the document. */
export interface FrontmatterMeta {
  title?: string;
  author?: string;
  date?: string;
  theme?: string;
  image_scale?: number;
  margin_top?: string;
  margin_bottom?: string;
  margin_left?: string;
  margin_right?: string;
}

/**
 * Extract YAML frontmatter from markdown text.
 *
 * Returns [remaining_markdown, frontmatter_dict]. If no frontmatter
 * is found, returns the original text and an empty object.
 */
export function parseFrontmatter(mdText: string): [string, FrontmatterMeta] {
  const match = mdText.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return [mdText, {}];
  try {
    const meta = yaml.load(match[1]) as FrontmatterMeta;
    if (typeof meta !== "object" || meta === null) return [mdText, {}];
    return [mdText.slice(match[0].length), meta];
  } catch {
    return [mdText, {}];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Transforms — each returns [html, scripts[], styles[]]
// ═══════════════════════════════════════════════════════════════════════

type TransformResult = [string, string[], string[]];
type Transform = (html: string) => TransformResult;

/** Convert fenced mermaid code blocks to Mermaid-compatible elements. */
function transformMermaid(html: string): TransformResult {
  html = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    '<pre class="mermaid">$1</pre>'
  );
  const scripts: string[] = [];
  if (html.includes('<pre class="mermaid">')) {
    scripts.push(
      '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>' +
      "<script>mermaid.initialize({startOnLoad:true});</script>"
    );
  }
  return [html, scripts, []];
}

/** GitHub alert types and their default labels/icons. */
const ALERT_TYPES: Record<string, [string, string]> = {
  NOTE: ["ℹ️", "note"],
  TIP: ["💡", "tip"],
  IMPORTANT: ["❗", "important"],
  WARNING: ["⚠️", "warning"],
  CAUTION: ["🔴", "caution"],
};

const ALERT_RE = /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?([\s\S]*?)<\/p>\s*<\/blockquote>/gi;

/** Convert GitHub-style alerts to styled callout divs. */
function transformAlerts(html: string): TransformResult {
  html = html.replace(ALERT_RE, (_match, type: string, body: string) => {
    const alertType = type.toUpperCase();
    const [icon, cssClass] = ALERT_TYPES[alertType] ?? ["", "note"];
    const title = alertType.charAt(0) + alertType.slice(1).toLowerCase();
    return (
      `<div class="md2pdf-alert md2pdf-alert-${cssClass}">` +
      `<p class="md2pdf-alert-title">${icon} ${title}</p>` +
      `<p>${body.trim()}</p></div>`
    );
  });
  return [html, [], []];
}

/** Convert task list markers to HTML checkboxes. */
function transformTaskLists(html: string): TransformResult {
  html = html.replace(
    /<li>\s*\[ \]\s*/g,
    '<li class="md2pdf-task"><input type="checkbox" disabled> '
  );
  html = html.replace(
    /<li>\s*\[x\]\s*/gi,
    '<li class="md2pdf-task md2pdf-task-done"><input type="checkbox" checked disabled> '
  );
  return [html, [], []];
}

/** Inject Highlight.js for syntax-highlighted code blocks. */
function transformSyntaxHighlight(html: string): TransformResult {
  const scripts: string[] = [];
  const styles: string[] = [];
  if (/class="language-/.test(html)) {
    styles.push(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css">'
    );
    scripts.push(
      '<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>' +
      "<script>hljs.highlightAll();</script>"
    );
  }
  return [html, scripts, styles];
}

/** Render LaTeX math expressions via KaTeX. */
function transformMath(html: string): TransformResult {
  const scripts: string[] = [];
  const styles: string[] = [];
  const hasBlockMath = /\$\$[\s\S]*?\$\$/.test(html);
  const hasInlineMath = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/.test(html);
  if (hasBlockMath || hasInlineMath) {
    styles.push(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">'
    );
    scripts.push(
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"></script>' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/contrib/auto-render.min.js"></script>' +
      "<script>document.addEventListener('DOMContentLoaded',function(){" +
      "renderMathInElement(document.body,{delimiters:[" +
      "{left:'$$',right:'$$',display:true}," +
      "{left:'$',right:'$',display:false}" +
      "]})});</script>"
    );
  }
  return [html, scripts, styles];
}

/** Convert <!-- pagebreak --> comments to CSS page breaks. */
function transformPageBreaks(html: string): TransformResult {
  html = html.replace(
    /<!--\s*pagebreak\s*-->/gi,
    '<div class="md2pdf-pagebreak"></div>'
  );
  return [html, [], []];
}

// ═══════════════════════════════════════════════════════════════════════
// Transform Pipeline
// ═══════════════════════════════════════════════════════════════════════

const TRANSFORMS: Transform[] = [
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
export function runTransforms(html: string): TransformResult {
  const allScripts: string[] = [];
  const allStyles: string[] = [];
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
export function convert(
  mdPath: string,
  htmlPath: string,
  cssPath: string,
  imageScale: number = 350
): number {
  let mdText = fs.readFileSync(mdPath, "utf-8");

  // Extract frontmatter (if present)
  const [remaining, meta] = parseFrontmatter(mdText);
  mdText = remaining;

  // Apply frontmatter overrides
  const scale = meta.image_scale ?? imageScale;

  // Scale images for PDF rendering
  mdText = mdText.replace(/height="300"/g, `height="${scale}"`);

  // Parse Markdown to HTML using markdown-it
  const md = new MarkdownIt({
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

  const html =
    "<!DOCTYPE html><html><head>" +
    headParts.join("") +
    "</head><body>" +
    transformedBody +
    "</body></html>";

  fs.writeFileSync(htmlPath, html, "utf-8");
  return fs.statSync(htmlPath).size;
}
