'use strict';
// File-level hygiene: no byte-order marks in files that users and tools read as text, every script parses,
// and the skill stays small enough to copy around.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, PLUGIN, walk, relPosix, readText } = require('./helpers');

const TEXT_EXT = new Set(['.js', '.json', '.md', '.html']);
const MAX_PLUGIN_BYTES = 400 * 1024;

// Files that must be free of a UTF-8 BOM: everything text under plugin/, the two docs, the manifests
// and package.json.
function bomCheckedFiles() {
  const pluginText = walk(PLUGIN).filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
  const rootFiles = ['README.md', 'INSTALL.md', 'package.json'].map((f) => path.join(ROOT, f));
  const manifests = walk(path.join(ROOT, '.claude-plugin'));
  return [...pluginText, ...rootFiles, ...manifests];
}

test('no UTF-8 BOM in plugin text files, README.md, INSTALL.md, .claude-plugin/ or package.json', () => {
  const files = bomCheckedFiles();
  assert.ok(files.length > 20, `expected to check many files, got ${files.length}`);
  const withBom = files.filter((f) => {
    const head = fs.readFileSync(f).subarray(0, 3);
    return head.length === 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  });
  assert.deepEqual(withBom.map((f) => relPosix(ROOT, f)), []);
});

// Every .js in the skill and in the repo's scripts/ folder must compile. vm.Script parses without running.
test('every plugin/**/*.js and scripts/*.js file parses', () => {
  const jsFiles = [
    ...walk(PLUGIN).filter((f) => f.endsWith('.js')),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'scripts', f)),
  ];
  assert.ok(jsFiles.length > 10, `expected to check many scripts, got ${jsFiles.length}`);
  const broken = [];
  for (const file of jsFiles) {
    // a leading #! line is valid for a node script but is not part of the JavaScript grammar
    const code = readText(file).replace(/^﻿/, '').replace(/^#![^\n]*/, '');
    try {
      new vm.Script(code, { filename: file });
    } catch (e) {
      broken.push(`${relPosix(ROOT, file)}: ${e.message}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('no file under plugin/ is larger than 400 KB', () => {
  const big = walk(PLUGIN)
    .map((f) => ({ f, size: fs.statSync(f).size }))
    .filter((x) => x.size > MAX_PLUGIN_BYTES)
    .map((x) => `${relPosix(PLUGIN, x.f)} (${x.size} bytes)`);
  assert.deepEqual(big, []);
});
