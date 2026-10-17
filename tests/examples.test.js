'use strict';
// The five shipped examples are the authoring reference. They must all validate; the three with no
// warnings must stay that way, so a style or layout regression shows up here first.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { SKILL_SCRIPTS, EXAMPLES, run, exampleFiles } = require('./helpers');

const VALIDATE = path.join(SKILL_SCRIPTS, 'validate.js');
const CLEAN = ['how-claude-works.js', 'sky-blue.js', 'how-claude-works-cinematic.js'];

test('there are five example scenarios', () => {
  assert.equal(exampleFiles().length, 5);
});

for (const name of exampleFiles()) {
  test(`example ${name} validates with exit 0`, () => {
    const r = run([VALIDATE, path.join(EXAMPLES, name)]);
    assert.equal(r.status, 0, r.output);
  });
}

for (const name of CLEAN) {
  test(`example ${name} reports 0 errors, 0 warnings`, () => {
    const r = run([VALIDATE, path.join(EXAMPLES, name)]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.stdout, /0 errors, 0 warnings/);
  });
}
