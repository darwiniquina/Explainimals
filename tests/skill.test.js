'use strict';
// SKILL.md is what an agent reads to decide to use the skill: its frontmatter must be well formed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PLUGIN, SKILL, walk, relPosix } = require('./helpers');

const skillMd = path.join(SKILL, 'SKILL.md');
const text = fs.readFileSync(skillMd, 'utf8');

// The frontmatter is the block between the first two "---" lines, and must start the file.
const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
const field = (name) => {
  const m = fm && new RegExp(`^${name}:[ \\t]*(.+?)[ \\t]*$`, 'm').exec(fm[1]);
  return m ? m[1].replace(/^(["'])(.*)\1$/, '$2') : undefined;
};

test('SKILL.md starts with a YAML frontmatter block', () => {
  assert.ok(text.startsWith('---'), 'the file must start with ---');
  assert.ok(fm, 'no closing --- for the frontmatter');
});

test('frontmatter name equals the skill folder name', () => {
  assert.equal(field('name'), 'explainimals');
  assert.equal(field('name'), path.basename(SKILL));
});

test('frontmatter description is non-empty, under 1024 characters, and says the output is .html', () => {
  const description = field('description');
  assert.ok(description && description.length > 0, 'description is missing or empty');
  assert.ok(description.length < 1024, `description is ${description.length} characters`);
  assert.match(description, /\.html/, 'description should say the output is an .html file');
});

test('no file under plugin/ uses the old hyphenated id "pixel-explainer"', () => {
  const hits = walk(PLUGIN).filter((file) => {
    // only text files can carry the id; binaries are skipped by a NUL-byte check
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) return false;
    return buf.toString('utf8').toLowerCase().includes('pixel-explainer');
  });
  assert.deepEqual(hits.map((f) => relPosix(PLUGIN, f)), []);
});
