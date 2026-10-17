'use strict';
// validate.js is the gate the AI runs before building. Its exit codes are a contract: 0 valid,
// 1 invalid scenario, 2 unreadable or bad input.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  SKILL_SCRIPTS, EXAMPLES, FIXTURES, run, makeTmp, rmTmp, exampleAsJson, readText,
} = require('./helpers');

const VALIDATE = path.join(SKILL_SCRIPTS, 'validate.js');
const BOM = '﻿';

test('a valid example exits 0', () => {
  const r = run([VALIDATE, path.join(EXAMPLES, 'sky-blue.js')]);
  assert.equal(r.status, 0, r.output);
});

test('a scenario with an unknown skin and background exits 1 and prints ERROR lines', () => {
  const r = run([VALIDATE, path.join(FIXTURES, 'broken.json')]);
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /ERROR/);
  assert.match(r.output, /unknown skin/);
  assert.match(r.output, /unknown background/);
});

test('a path that does not exist exits 2', () => {
  const r = run([VALIDATE, path.join(FIXTURES, 'no-such-file.json')]);
  assert.equal(r.status, 2, r.output);
});

test('a JSON file that is not valid JSON exits 2', () => {
  const tmp = makeTmp('cli-badjson');
  try {
    const file = path.join(tmp, 'bad.json');
    fs.writeFileSync(file, '{ "title": ', 'utf8');
    const r = run([VALIDATE, file]);
    assert.equal(r.status, 2, r.output);
  } finally {
    rmTmp(tmp);
  }
});

test('a JSON scenario that starts with a UTF-8 byte-order mark is accepted (exit 0)', () => {
  const tmp = makeTmp('cli-bom');
  try {
    // PowerShell and some Windows editors write a BOM; the parser must not choke on it
    const file = path.join(tmp, 'bom-scenario.json');
    fs.writeFileSync(file, BOM + JSON.stringify(exampleAsJson(path.join(EXAMPLES, 'sky-blue.js')), null, 2), 'utf8');
    assert.equal(fs.readFileSync(file, 'utf8').charCodeAt(0), 0xfeff, 'the test file must really carry a BOM');
    const r = run([VALIDATE, file]);
    assert.equal(r.status, 0, r.output);
  } finally {
    rmTmp(tmp);
  }
});

test('the crowded fixture, with its BOM stripped, validates with exit 0', () => {
  const r = run([VALIDATE, path.join(FIXTURES, 'crowd.json')]);
  assert.equal(r.status, 0, r.output);
  assert.equal(readText(path.join(FIXTURES, 'crowd.json')).charCodeAt(0) === 0xfeff, false, 'fixture should have no BOM');
});
