/**
 * Tests for lib/md2html.js — Node.js Markdown to HTML conversion.
 *
 * Validates frontmatter parsing, transform pipeline, and full conversion.
 * Mirrors test coverage from tests/test_md2html.py (Python version).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { convert, parseFrontmatter, runTransforms } = require("../lib/md2html");

// Helper: create a temp directory for test fixtures
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "md2html-test-"));
}

// Helper: write a minimal CSS theme for testing
function writeTempCss(dir) {
  const cssPath = path.join(dir, "test.css");
  fs.writeFileSync(cssPath, "body { font-family: sans-serif; }", "utf-8");
  return cssPath;
}

// ─── parseFrontmatter ────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  test("extracts YAML frontmatter", () => {
    const md = "---\ntitle: Test Doc\nauthor: Alice\ndate: 2025-01-01\n---\n# Hello";
    const [remaining, meta] = parseFrontmatter(md);
    expect(meta.title).toBe("Test Doc");
    expect(meta.author).toBe("Alice");
    // js-yaml parses dates as Date objects
    expect(meta.date).toBeTruthy();
    expect(remaining).toBe("# Hello");
  });

  test("returns empty object when no frontmatter", () => {
    const md = "# No Frontmatter\n\nJust markdown.";
    const [remaining, meta] = parseFrontmatter(md);
    expect(meta).toEqual({});
    expect(remaining).toBe(md);
  });

  test("extracts theme from frontmatter", () => {
    const md = "---\ntheme: academic\n---\n# Content";
    const [, meta] = parseFrontmatter(md);
    expect(meta.theme).toBe("academic");
  });

  test("extracts image_scale from frontmatter", () => {
    const md = "---\nimage_scale: 500\n---\n# Content";
    const [, meta] = parseFrontmatter(md);
    expect(meta.image_scale).toBe(500);
  });

  test("extracts margin settings from frontmatter", () => {
    const md = "---\nmargin_top: 1in\nmargin_bottom: 1in\n---\n# Content";
    const [, meta] = parseFrontmatter(md);
    expect(meta.margin_top).toBe("1in");
    expect(meta.margin_bottom).toBe("1in");
  });

  test("handles malformed YAML gracefully", () => {
    const md = "---\n: invalid yaml:\n  bad: [unclosed\n---\n# Content";
    const [remaining, meta] = parseFrontmatter(md);
    // Should return original text and empty object on parse error
    expect(typeof remaining).toBe("string");
    expect(typeof meta).toBe("object");
  });
});

// ─── runTransforms ───────────────────────────────────────────────────

describe("runTransforms", () => {
  test("transforms Mermaid code blocks", () => {
    const html = '<pre><code class="language-mermaid">graph LR\n  A-->B</code></pre>';
    const [result, scripts] = runTransforms(html);
    expect(result).toContain('class="mermaid"');
    expect(scripts.some((s) => s.includes("mermaid"))).toBe(true);
  });

  test("transforms GitHub alerts", () => {
    const html = "<blockquote>\n<p>[!NOTE]\nThis is a note</p>\n</blockquote>";
    const [result] = runTransforms(html);
    expect(result).toContain("md2pdf-alert");
    expect(result).toContain("md2pdf-alert-note");
  });

  test("transforms all alert types", () => {
    for (const type of ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]) {
      const html = `<blockquote>\n<p>[!${type}]\nAlert body</p>\n</blockquote>`;
      const [result] = runTransforms(html);
      expect(result).toContain("md2pdf-alert");
    }
  });

  test("transforms task lists", () => {
    const html = "<li>[ ] unchecked</li><li>[x] checked</li>";
    const [result] = runTransforms(html);
    expect(result).toContain("md2pdf-task");
    expect(result).toContain('type="checkbox"');
    expect(result).toContain("checked");
  });

  test("injects syntax highlighting for code blocks", () => {
    const html = '<pre><code class="language-python">print("hello")</code></pre>';
    const [, scripts, styles] = runTransforms(html);
    expect(styles.some((s) => s.includes("highlightjs"))).toBe(true);
    expect(scripts.some((s) => s.includes("highlight.min.js"))).toBe(true);
  });

  test("injects KaTeX for math expressions", () => {
    const html = "<p>Inline $x^2$ and block $$E=mc^2$$</p>";
    const [, scripts, styles] = runTransforms(html);
    expect(styles.some((s) => s.includes("katex"))).toBe(true);
    expect(scripts.some((s) => s.includes("katex.min.js"))).toBe(true);
  });

  test("transforms page breaks", () => {
    const html = "<p>Before</p><!-- pagebreak --><p>After</p>";
    const [result] = runTransforms(html);
    expect(result).toContain("md2pdf-pagebreak");
    expect(result).not.toContain("<!-- pagebreak -->");
  });

  test("handles HTML without any transform targets", () => {
    const html = "<p>Plain text, no transforms needed.</p>";
    const [result, scripts, styles] = runTransforms(html);
    expect(result).toBe(html);
    expect(scripts).toHaveLength(0);
    expect(styles).toHaveLength(0);
  });
});

// ─── convert (full pipeline) ─────────────────────────────────────────

describe("convert", () => {
  let tmpDir;
  let cssPath;

  beforeEach(() => {
    tmpDir = createTempDir();
    cssPath = writeTempCss(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("converts basic markdown to HTML", () => {
    const mdPath = path.join(tmpDir, "test.md");
    const htmlPath = path.join(tmpDir, "test.html");
    fs.writeFileSync(mdPath, "# Hello\n\nWorld", "utf-8");

    const size = convert(mdPath, htmlPath, cssPath);
    expect(size).toBeGreaterThan(0);
    expect(fs.existsSync(htmlPath)).toBe(true);

    const html = fs.readFileSync(htmlPath, "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<p>World</p>");
  });

  test("embeds CSS theme in output", () => {
    const mdPath = path.join(tmpDir, "test.md");
    const htmlPath = path.join(tmpDir, "test.html");
    fs.writeFileSync(mdPath, "# Test", "utf-8");

    convert(mdPath, htmlPath, cssPath);
    const html = fs.readFileSync(htmlPath, "utf-8");
    expect(html).toContain("font-family: sans-serif");
  });

  test("handles frontmatter title", () => {
    const mdPath = path.join(tmpDir, "test.md");
    const htmlPath = path.join(tmpDir, "test.html");
    fs.writeFileSync(mdPath, "---\ntitle: My Document\n---\n# Content", "utf-8");

    convert(mdPath, htmlPath, cssPath);
    const html = fs.readFileSync(htmlPath, "utf-8");
    expect(html).toContain("<title>My Document</title>");
  });

  test("applies image scale from frontmatter", () => {
    const mdPath = path.join(tmpDir, "test.md");
    const htmlPath = path.join(tmpDir, "test.html");
    fs.writeFileSync(
      mdPath,
      '---\nimage_scale: 500\n---\n<img height="300" src="chart.svg">',
      "utf-8"
    );

    convert(mdPath, htmlPath, cssPath);
    const html = fs.readFileSync(htmlPath, "utf-8");
    expect(html).toContain('height="500"');
    expect(html).not.toContain('height="300"');
  });

  test("returns file size in bytes", () => {
    const mdPath = path.join(tmpDir, "test.md");
    const htmlPath = path.join(tmpDir, "test.html");
    fs.writeFileSync(mdPath, "Short", "utf-8");

    const size = convert(mdPath, htmlPath, cssPath);
    const actual = fs.statSync(htmlPath).size;
    expect(size).toBe(actual);
  });
});
