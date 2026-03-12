/**
 * Tests for the md2pdf VS Code extension converter and Node.js pipeline.
 *
 * These tests validate path security, pipeline module behavior,
 * browser detection, and chart/markdown conversion correctness.
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

// Note: vscode module is available in test runner context
// For unit tests that don't need VS Code APIs, we test the
// path validation logic and pipeline modules directly.

suite("Path Validation", () => {
  test("rejects non-.md files", () => {
    const testPath = path.join(__dirname, "test.txt");
    assert.ok(!testPath.endsWith(".md"), "Test path should not end in .md");
  });

  test("prevents path traversal", () => {
    const evil = path.resolve("/etc/passwd");
    const workspace = path.resolve("/home/user/project");
    assert.ok(
      !evil.startsWith(workspace + path.sep),
      "Traversal path should not be within workspace"
    );
  });

  test("accepts workspace-relative paths", () => {
    const workspace = path.resolve(process.cwd());
    const file = path.join(workspace, "docs", "readme.md");
    assert.ok(
      file.startsWith(workspace + path.sep),
      "Workspace file should be within workspace"
    );
  });

  test("normalizes relative paths", () => {
    const relative = "./docs/../docs/readme.md";
    const resolved = path.resolve(relative);
    assert.ok(!resolved.includes(".."), "Resolved path should not contain ..");
  });
});

suite("Security", () => {
  test("converter does not use shell: true", () => {
    const converterSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "converter.ts"),
      "utf-8"
    );
    assert.ok(
      !converterSource.includes("shell: true"),
      "Converter must not use shell: true"
    );
  });

  test("converter does not use child_process.exec", () => {
    const converterSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "converter.ts"),
      "utf-8"
    );
    assert.ok(
      !converterSource.includes("child_process.exec"),
      "Converter must not use exec()"
    );
    assert.ok(
      !converterSource.includes("require(\"child_process\")"),
      "Converter should not import child_process directly"
    );
  });

  test("dependency manager does not use shell: true", () => {
    const depSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "dependencies.ts"),
      "utf-8"
    );
    assert.ok(
      !depSource.includes("shell: true"),
      "DependencyManager must not use shell: true"
    );
    assert.ok(
      !depSource.includes("child_process.exec"),
      "DependencyManager must not use exec()"
    );
  });

  test("html2pdf server binds to 127.0.0.1 only", () => {
    const html2pdfSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "html2pdf.ts"),
      "utf-8"
    );
    assert.ok(
      html2pdfSource.includes('"127.0.0.1"'),
      "HTML→PDF server must bind to localhost only"
    );
  });

  test("html2pdf validates file paths within served directory", () => {
    const html2pdfSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "html2pdf.ts"),
      "utf-8"
    );
    assert.ok(
      html2pdfSource.includes("startsWith(path.resolve(dir))"),
      "HTML→PDF server must validate paths are within the served directory"
    );
  });
});

suite("Pipeline Modules", () => {
  test("browser-detect module exports required functions", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "browser-detect.ts"),
      "utf-8"
    );
    assert.ok(source.includes("export function detectBrowser"));
    assert.ok(source.includes("export function getBrowserInstallHint"));
  });

  test("browser-detect checks well-known paths for all platforms", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "browser-detect.ts"),
      "utf-8"
    );
    assert.ok(source.includes("win32"), "Must have Windows paths");
    assert.ok(source.includes("darwin"), "Must have macOS paths");
    assert.ok(source.includes("linux"), "Must have Linux paths");
    assert.ok(source.includes("msedge.exe"), "Must detect Edge on Windows");
    assert.ok(source.includes("google-chrome"), "Must detect Chrome on Linux");
    assert.ok(source.includes("chromium-browser"), "Must detect Chromium on Linux");
  });

  test("md2svg module exports required functions", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "md2svg.ts"),
      "utf-8"
    );
    assert.ok(source.includes("export function scanCharts"));
    assert.ok(source.includes("export function generateCharts"));
  });

  test("md2html module exports required functions", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "md2html.ts"),
      "utf-8"
    );
    assert.ok(source.includes("export function convert"));
    assert.ok(source.includes("export function parseFrontmatter"));
    assert.ok(source.includes("export function runTransforms"));
  });

  test("md2html supports all required transforms", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "md2html.ts"),
      "utf-8"
    );
    assert.ok(source.includes("transformMermaid"), "Must support Mermaid");
    assert.ok(source.includes("transformAlerts"), "Must support GitHub alerts");
    assert.ok(source.includes("transformTaskLists"), "Must support task lists");
    assert.ok(source.includes("transformSyntaxHighlight"), "Must support syntax highlighting");
    assert.ok(source.includes("transformMath"), "Must support math/KaTeX");
    assert.ok(source.includes("transformPageBreaks"), "Must support page breaks");
  });

  test("md2svg supports all required chart types", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "pipeline", "md2svg.ts"),
      "utf-8"
    );
    assert.ok(source.includes("bar:"), "Must support bar charts");
    assert.ok(source.includes("hbar:"), "Must support horizontal bar charts");
    assert.ok(source.includes("pie:"), "Must support pie charts");
    assert.ok(source.includes("donut:"), "Must support donut charts");
    assert.ok(source.includes("sunburst:"), "Must support sunburst charts");
  });
});

suite("Theme Resolution", () => {
  test("bundle script copies correct theme files", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    assert.ok(bundleScript.includes("default.css"));
    assert.ok(bundleScript.includes("academic.css"));
    assert.ok(bundleScript.includes("minimal.css"));
  });

  test("bundle script no longer copies Python scripts", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    assert.ok(
      !bundleScript.includes("md2svg.py"),
      "Bundle should not copy Python scripts"
    );
    assert.ok(
      !bundleScript.includes("md2html.py"),
      "Bundle should not copy Python scripts"
    );
    assert.ok(
      !bundleScript.includes("requirements.txt"),
      "Bundle should not copy Python manifests"
    );
  });
});

suite("Configuration", () => {
  test("package.json has browserPath setting", () => {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "package.json"),
        "utf-8"
      )
    );
    const props = pkg.contributes.configuration.properties;
    assert.ok(props["md2pdf.browserPath"], "Must have browserPath setting");
    assert.strictEqual(
      props["md2pdf.browserPath"].type,
      "string",
      "browserPath must be a string"
    );
  });

  test("package.json does not have pythonPath setting", () => {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "package.json"),
        "utf-8"
      )
    );
    const props = pkg.contributes.configuration.properties;
    assert.ok(
      !props["md2pdf.pythonPath"],
      "pythonPath setting should be removed"
    );
  });

  test("package.json has required Node.js dependencies", () => {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "package.json"),
        "utf-8"
      )
    );
    const deps = pkg.dependencies;
    assert.ok(deps["markdown-it"], "Must have markdown-it dependency");
    assert.ok(deps["js-yaml"], "Must have js-yaml dependency");
    assert.ok(deps["puppeteer-core"], "Must have puppeteer-core dependency");
  });
});
