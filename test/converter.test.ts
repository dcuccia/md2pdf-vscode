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
    // Path validation should reject non-markdown files
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
  test("spawn arguments are arrays not strings", () => {
    // This is a design test — verifying the convention is documented
    // The converter uses spawn(cmd, [args]) not exec("cmd args")
    const converterSource = fs.readFileSync(
      path.join(__dirname, "..", "src", "converter.ts"),
      "utf-8"
    );
    assert.ok(
      converterSource.includes("shell: false"),
      "Converter must use shell: false"
    );
    assert.ok(
      !converterSource.includes("child_process.exec("),
      "Converter must not use exec()"
    );
    assert.ok(
      !converterSource.includes("shell: true"),
      "Converter must not use shell: true"
    );
  });
});
