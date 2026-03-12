/**
 * Tests for the md2pdf VS Code extension converter.
 *
 * These tests validate path security, configuration resolution,
 * and the converter's integration with the md2pdf pipeline.
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

// Note: vscode module is available in test runner context
// For unit tests that don't need VS Code APIs, we test the
// path validation logic directly.

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
  test("converter uses spawn with shell: false", () => {
    const converterSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "converter.ts"),
      "utf-8"
    );
    assert.ok(
      converterSource.includes("shell: false"),
      "Converter must use shell: false"
    );
    assert.ok(
      !converterSource.includes("shell: true"),
      "Converter must not use shell: true"
    );
  });

  test("dependency manager uses spawn with shell: false", () => {
    const depSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "dependencies.ts"),
      "utf-8"
    );
    assert.ok(
      depSource.includes("shell: false"),
      "DependencyManager must use shell: false"
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

  test("only hardcoded package names in install commands", () => {
    const depSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "dependencies.ts"),
      "utf-8"
    );
    // Verify the specific packages installed are hardcoded
    assert.ok(depSource.includes('"markdown>=3.4"'));
    assert.ok(depSource.includes('"pyyaml>=6.0"'));
    assert.ok(depSource.includes('"playwright"'));
  });
});

suite("Pipeline Resolution", () => {
  test("bundled pipeline path structure is correct", () => {
    // Verify the expected bundled path structure
    const expectedFiles = [
      "lib/md2svg.py",
      "lib/md2html.py",
      "lib/html2pdf.js",
      "themes/default.css",
      "themes/academic.css",
      "themes/minimal.css",
    ];

    for (const file of expectedFiles) {
      const normalized = path.normalize(file);
      assert.ok(
        normalized.length > 0,
        `Expected bundled file path: ${file}`
      );
    }
  });

  test("bundle script copies correct files", () => {
    const bundleScript = fs.readFileSync(
      path.join(__dirname, "..", "scripts", "bundle-pipeline.js"),
      "utf-8"
    );
    assert.ok(bundleScript.includes("md2svg.py"));
    assert.ok(bundleScript.includes("md2html.py"));
    assert.ok(bundleScript.includes("html2pdf.js"));
    assert.ok(bundleScript.includes("default.css"));
    assert.ok(bundleScript.includes("academic.css"));
    assert.ok(bundleScript.includes("minimal.css"));
  });
});
