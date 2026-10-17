'use strict';
// The install docs send people and AI agents to the skill folder. Their links must point at a folder that
// exists, and the paths in INSTALL.md's commands must be real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, readText } = require('./helpers');

const SKILL_PATH = 'plugin/skills/explainimals';
const TREE_URL = `https://github.com/darwiniquina/Explainimals/tree/main/${SKILL_PATH}`;
const README = readText(path.join(ROOT, 'README.md'));
const INSTALL = readText(path.join(ROOT, 'INSTALL.md'));

test('README.md and INSTALL.md both name the skill folder', () => {
  assert.ok(README.includes(SKILL_PATH), 'README.md does not mention plugin/skills/explainimals');
  assert.ok(INSTALL.includes(SKILL_PATH), 'INSTALL.md does not mention plugin/skills/explainimals');
});

test('the skill folder path exists in the repo', () => {
  assert.ok(fs.statSync(path.join(ROOT, SKILL_PATH)).isDirectory());
});

test('README.md and INSTALL.md both link the GitHub tree URL of the skill folder', () => {
  assert.ok(README.includes(TREE_URL), `README.md is missing ${TREE_URL}`);
  assert.ok(INSTALL.includes(TREE_URL), `INSTALL.md is missing ${TREE_URL}`);
});

test('every backticked plugin/ path in INSTALL.md exists', () => {
  const paths = [...INSTALL.matchAll(/`(plugin\/[^`\s]+)`/g)].map((m) => m[1]);
  assert.ok(paths.length >= 3, `expected several plugin/ paths in INSTALL.md, found ${paths.length}`);
  const missing = paths.filter((p) => !fs.existsSync(path.join(ROOT, p)));
  assert.deepEqual(missing, []);
});
