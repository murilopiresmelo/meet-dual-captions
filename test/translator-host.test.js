const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, openSync, readSync, closeSync } = require("node:fs");
const { resolve } = require("node:path");

const { modelFilePaths } = require("../translator-host.js");

test("loads local models for English to Portuguese and Portuguese to English", () => {
  for (const [from, to] of [["en", "pt"], ["pt", "en"]]) {
    const files = modelFilePaths(from, to);
    for (const path of Object.values(files)) {
      assert.equal(existsSync(resolve(__dirname, "..", path)), true, `missing ${path}`);
      const descriptor = openSync(resolve(__dirname, "..", path), "r");
      const header = Buffer.alloc(2);
      readSync(descriptor, header, 0, 2, 0);
      closeSync(descriptor);
      assert.notDeepEqual([...header], [0x1f, 0x8b], `compressed ${path}`);
    }
  }
});
