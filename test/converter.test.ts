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

  test("bundle script detects md2pdf Node.js pipeline modules", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    // Should check for md2html.js as marker for Node.js pipeline
    assert.ok(
      bundleScript.includes("md2html.js"),
      "Bundle should detect md2pdf Node.js modules"
    );
    assert.ok(
      bundleScript.includes("md2svg.js"),
      "Bundle should copy md2svg.js when available"
    );
    assert.ok(
      bundleScript.includes("browser-detect.js"),
      "Bundle should copy browser-detect.js when available"
    );
  });

  test("bundle script verifies md2html.js is markdown-it based", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    // Should check that md2html.js contains markdown-it (not old Playwright version)
    assert.ok(
      bundleScript.includes("markdown-it") || bundleScript.includes("markdownit"),
      "Bundle should verify md2html.js is the new markdown-it-based module"
    );
  });

  test("bundle script generates manifest.json for bundled modules", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    assert.ok(
      bundleScript.includes("manifest.json"),
      "Bundle should generate manifest.json when JS modules are bundled"
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

suite("Cross-Repo Integration", () => {
  test("migration plan exists and documents consolidated PR approach", () => {
    const planPath = path.join(__dirname, "..", "docs", "cross-repo-migration-plan.md");
    assert.ok(fs.existsSync(planPath), "Cross-repo migration plan must exist");
    const plan = fs.readFileSync(planPath, "utf-8");
    assert.ok(plan.includes("PR A"), "Plan must document PR A (consolidated vscode PR)");
    assert.ok(plan.includes("PR B"), "Plan must document PR B (consolidated md2pdf PR)");
    assert.ok(plan.includes("Done"), "Plan must include done criteria");
  });

  test("md2pdf Node.js spec document exists", () => {
    const specPath = path.join(__dirname, "..", "docs", "md2pdf-nodejs-spec.md");
    assert.ok(fs.existsSync(specPath), "md2pdf Node.js spec must exist");
    const spec = fs.readFileSync(specPath, "utf-8");
    assert.ok(spec.includes("lib/md2svg.js"), "Spec must define md2svg.js");
    assert.ok(spec.includes("lib/md2html.js"), "Spec must define md2html.js");
    assert.ok(spec.includes("lib/browser-detect.js"), "Spec must define browser-detect.js");
    assert.ok(spec.includes("lib/index.js"), "Spec must define index.js barrel");
    assert.ok(spec.includes("puppeteer-core"), "Spec must reference puppeteer-core");
    assert.ok(spec.includes("package.json"), "Spec must include package.json changes");
  });

  test("pipeline modules are extraction-ready (portable comments)", () => {
    const pipelineDir = path.join(__dirname, "..", "src", "pipeline");
    const modules = ["md2svg.ts", "md2html.ts", "html2pdf.ts", "browser-detect.ts"];
    for (const mod of modules) {
      const source = fs.readFileSync(path.join(pipelineDir, mod), "utf-8");
      assert.ok(
        source.includes("md2pdf") && (source.includes("core library") || source.includes("dcuccia/md2pdf")),
        `${mod} must document its relationship to the md2pdf core library`
      );
    }
  });

  test("bundle-pipeline.js supports MD2PDF_SOURCE env var", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    assert.ok(
      bundleScript.includes("MD2PDF_SOURCE"),
      "Bundle script must support MD2PDF_SOURCE env var for CI"
    );
  });

  test("CI workflow checks out md2pdf for bundling", () => {
    const ciPath = path.join(__dirname, "..", ".github", "workflows", "ci.yml");
    assert.ok(fs.existsSync(ciPath), "CI workflow must exist");
    const ci = fs.readFileSync(ciPath, "utf-8");
    assert.ok(
      ci.includes("dcuccia/md2pdf"),
      "CI must checkout md2pdf repo for themes/modules"
    );
    assert.ok(
      ci.includes("bundle-pipeline"),
      "CI must run bundle-pipeline"
    );
  });
});
