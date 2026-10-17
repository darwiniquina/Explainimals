'use strict';
// The skill ships copies of the workshop engine and example scenarios. A stale copy means the skill
// would teach the AI an engine that no longer matches the one under development, so compare them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  SKILL_RUNTIME, EXAMPLES, WORKSHOP_CHARACTER, WORKSHOP_PRESENTATION, WORKSHOP_SCENARIOS,
  readNormalised, walk, relPosix, exampleFiles,
} = require('./helpers');

// The runtime files the packager copies, in the workshop layout. Skins are found, not listed, so a new
// skin file is picked up automatically.
const PRESENTATION = ['pixel', 'registry', 'font', 'ui', 'backgrounds', 'props', 'emotes', 'audio', 'engine'];
const workshopRuntime = [
  'character/parts.js',
  'character/character.js',
  ...fs.readdirSync(WORKSHOP_CHARACTER).filter((f) => /^skin-.*\.js$/.test(f)).sort().map((f) => `character/${f}`),
  ...PRESENTATION.map((n) => `presentation/${n}.js`),
];

test('every workshop runtime file exists in the skill and matches it (EOL-normalised)', () => {
  assert.ok(workshopRuntime.length >= 17, `expected at least 17 runtime files, found ${workshopRuntime.length}`);
  for (const rel of workshopRuntime) {
    const source = path.join(rel.startsWith('character/') ? WORKSHOP_CHARACTER : WORKSHOP_PRESENTATION, rel.replace(/^(character|presentation)\//, ''));
    const copy = path.join(SKILL_RUNTIME, rel);
    assert.ok(fs.existsSync(copy), `missing in skill runtime: ${rel}`);
    assert.equal(readNormalised(copy), readNormalised(source), `out of date: ${rel}`);
  }
});

test('the skill runtime holds exactly the workshop runtime files and nothing else', () => {
  const copies = walk(SKILL_RUNTIME).map((f) => relPosix(SKILL_RUNTIME, f)).sort();
  assert.deepEqual(copies, [...workshopRuntime].sort());
});

test('each reference example equals its workshop scenario (EOL-normalised)', () => {
  for (const name of exampleFiles()) {
    const source = path.join(WORKSHOP_SCENARIOS, name);
    assert.ok(fs.existsSync(source), `no workshop scenario for ${name}`);
    assert.equal(readNormalised(path.join(EXAMPLES, name)), readNormalised(source), `out of date: ${name}`);
  }
});

test('the skill examples are exactly the workshop scenarios (no extra or missing example)', () => {
  const workshop = fs.readdirSync(WORKSHOP_SCENARIOS).filter((f) => f.endsWith('.js')).sort();
  assert.deepEqual(exampleFiles(), workshop);
});
