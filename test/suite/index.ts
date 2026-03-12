/**
 * Test suite loader for @vscode/test-electron.
 */

import * as path from "path";
import Mocha from "mocha";
import * as fs from "fs";

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true });
  const testsRoot = path.resolve(__dirname, "..");

  return new Promise((resolve, reject) => {
    const testFiles = fs.readdirSync(testsRoot).filter((f) => f.endsWith(".test.js"));

    for (const f of testFiles) {
      mocha.addFile(path.resolve(testsRoot, f));
    }

    try {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
