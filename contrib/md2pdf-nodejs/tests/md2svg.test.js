/**
 * Tests for lib/md2svg.js — Node.js SVG chart generation.
 *
 * Validates chart scanning, parsing, and SVG generation for all chart types.
 * Mirrors test coverage from tests/test_md2svg.py (Python version).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { generateCharts, scanCharts } = require("../lib/md2svg");

// Helper: create a temp directory for test fixtures
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "md2svg-test-"));
}

// Helper: write a temp markdown file
function writeTempMd(dir, content) {
  const filePath = path.join(dir, "test.md");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ─── scanCharts ──────────────────────────────────────────────────────

describe("scanCharts", () => {
  test("parses YAML @chart block", () => {
    const md = [
      "# My Doc",
      "",
      "```yaml",
      "# @chart → revenue.svg",
      "type: bar",
      "title: Revenue",
      "data:",
      "  Q1: 100",
      "  Q2: 200",
      "  Q3: 150",
      "```",
    ].join("\n");

    const specs = scanCharts(md);
    expect(specs).toHaveLength(1);
    expect(specs[0]._filename).toBe("revenue.svg");
    expect(specs[0].type).toBe("bar");
    expect(specs[0].title).toBe("Revenue");
    expect(specs[0].data).toEqual({ Q1: 100, Q2: 200, Q3: 150 });
  });

  test("parses multiple chart blocks", () => {
    const md = [
      "```yaml",
      "# @chart → a.svg",
      "type: bar",
      "data:",
      "  X: 10",
      "```",
      "",
      "```yaml",
      "# @chart → b.svg",
      "type: pie",
      "data:",
      "  A: 50",
      "  B: 50",
      "```",
    ].join("\n");

    const specs = scanCharts(md);
    expect(specs).toHaveLength(2);
    expect(specs[0]._filename).toBe("a.svg");
    expect(specs[1]._filename).toBe("b.svg");
  });

  test("parses pipe table chart", () => {
    const md = [
      "<!-- @chart: bar → table.svg -->",
      "| Label | Value |",
      "|-------|-------|",
      "| Alpha | 10    |",
      "| Beta  | 20    |",
      "", // trailing newline needed for regex match
    ].join("\n");

    const specs = scanCharts(md);
    expect(specs).toHaveLength(1);
    expect(specs[0]._filename).toBe("table.svg");
    expect(specs[0].type).toBe("bar");
    expect(specs[0].data).toEqual({ Alpha: 10, Beta: 20 });
  });

  test("returns empty for markdown without charts", () => {
    const specs = scanCharts("# Just a heading\n\nSome text.");
    expect(specs).toHaveLength(0);
  });

  test("ignores charts inside 4+ backtick fences", () => {
    const md = [
      "````",
      "```yaml",
      "# @chart → should-ignore.svg",
      "type: bar",
      "data:",
      "  X: 1",
      "```",
      "````",
    ].join("\n");

    const specs = scanCharts(md);
    expect(specs).toHaveLength(0);
  });
});

// ─── generateCharts ──────────────────────────────────────────────────

describe("generateCharts", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("generates bar chart SVG", () => {
    const mdPath = writeTempMd(tmpDir, [
      "```yaml",
      "# @chart → chart.svg",
      "type: bar",
      "title: Test Bar",
      "data:",
      "  A: 10",
      "  B: 20",
      "  C: 15",
      "```",
    ].join("\n"));

    const files = generateCharts(mdPath);
    expect(files).toHaveLength(1);
    expect(files[0]).toBe("chart.svg");

    const svg = fs.readFileSync(path.join(tmpDir, "chart.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Test Bar");
    expect(svg).toContain("</svg>");
  });

  test("generates hbar chart SVG", () => {
    const mdPath = writeTempMd(tmpDir, [
      "```yaml",
      "# @chart → hbar.svg",
      "type: hbar",
      "title: Horizontal",
      "data:",
      "  X: 30",
      "  Y: 50",
      "```",
    ].join("\n"));

    const files = generateCharts(mdPath);
    expect(files).toHaveLength(1);
    const svg = fs.readFileSync(path.join(tmpDir, "hbar.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Horizontal");
  });

  test("generates pie chart SVG", () => {
    const mdPath = writeTempMd(tmpDir, [
      "```yaml",
      "# @chart → pie.svg",
      "type: pie",
      "title: Distribution",
      "data:",
      "  Slice A: 40",
      "  Slice B: 60",
      "```",
    ].join("\n"));

    const files = generateCharts(mdPath);
    expect(files).toHaveLength(1);
    const svg = fs.readFileSync(path.join(tmpDir, "pie.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
  });

  test("generates donut chart SVG", () => {
    const mdPath = writeTempMd(tmpDir, [
      "```yaml",
      "# @chart → donut.svg",
      "type: donut",
      "data:",
      "  Inner: 30",
      "  Outer: 70",
      "```",
    ].join("\n"));

    const files = generateCharts(mdPath);
    expect(files).toHaveLength(1);
    const svg = fs.readFileSync(path.join(tmpDir, "donut.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
  });

  test("generates sunburst chart SVG", () => {
    const mdPath = writeTempMd(tmpDir, [
      "```yaml",
      "# @chart → sunburst.svg",
      "type: sunburst",
      "title: Nested",
      "data:",
      "  Group A:",
      "    Item 1: 10",
      "    Item 2: 20",
      "  Group B:",
      "    Item 3: 30",
      "```",
    ].join("\n"));

    const files = generateCharts(mdPath);
    expect(files).toHaveLength(1);
    const svg = fs.readFileSync(path.join(tmpDir, "sunburst.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Nested");
  });

  test("returns empty array when no charts", () => {
    const mdPath = writeTempMd(tmpDir, "# No charts here\n\nJust text.");
    const files = generateCharts(mdPath);
    expect(files).toHaveLength(0);
  });

  test("skips unknown chart types", () => {
    const mdPath = writeTempMd(tmpDir, [
      "```yaml",
      "# @chart → unknown.svg",
      "type: scatter",
      "data:",
      "  A: 10",
      "```",
    ].join("\n"));

    const files = generateCharts(mdPath);
    expect(files).toHaveLength(0);
  });
});
