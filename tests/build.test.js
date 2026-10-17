'use strict';
// build.js packs the player, the runtime and one scenario into one HTML file. The file is handed to a
// user who may be offline, so it must be self-contained and every inline script must compile.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  SKILL_SCRIPTS, EXAMPLES, run, makeTmp, rmTmp, exampleAsJson,
} = require('./helpers');

const BUILD = path.join(SKILL_SCRIPTS, 'build.js');
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_BYTES = 2 * 1024 * 1024;

// Inline <script> blocks only; a block with a src attribute would fetch code, which the output must not do.
function inlineScripts(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!/\bsrc\s*=/i.test(m[1])) blocks.push(m[2]);
  }
  return blocks;
}

// Builds `input` into a fresh temp folder and checks the result. `label` names the case in failures.
function buildAndCheck(input, label) {
  const tmp = makeTmp('build');
  try {
    const out = path.join(tmp, 'out', 'explainer.html');
    const r = run([BUILD, input, '-o', out]);
    assert.equal(r.status, 0, `${label}: build.js exited ${r.status}: ${r.output}`);
    assert.ok(fs.existsSync(out), `${label}: no HTML written`);

    const html = fs.readFileSync(out, 'utf8');

    assert.ok(!html.includes('<!--RUNTIME-->'), `${label}: runtime marker left in the output`);
    assert.ok(!html.includes('<!--SCENARIO-->'), `${label}: scenario marker left in the output`);

    const title = /<title>([\s\S]*?)<\/title>/i.exec(html);
    assert.ok(title && title[1].includes('Explainimals'), `${label}: <title> must contain "Explainimals"`);

    const size = fs.statSync(out).size;
    assert.ok(size < MAX_BYTES, `${label}: ${size} bytes is over 2 MB`);

    const urls = html.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
    const external = urls.filter((u) => u !== SVG_NS);
    assert.deepEqual(external, [], `${label}: the output must be self-contained, found URLs`);

    const scripts = inlineScripts(html);
    assert.ok(scripts.length > 0, `${label}: no inline scripts found`);
    scripts.forEach((code, i) => {
      try {
        new vm.Script(code, { filename: `${label}-inline-${i}.js` });
      } catch (e) {
        assert.fail(`${label}: inline script ${i} does not compile: ${e.message}`);
      }
    });
  } finally {
    rmTmp(tmp);
  }
}

test('build.js packs sky-blue.js into one self-contained HTML file', () => {
  buildAndCheck(path.join(EXAMPLES, 'sky-blue.js'), 'sky-blue.js');
});

test('build.js packs a BOM-prefixed JSON scenario into one self-contained HTML file', () => {
  const tmp = makeTmp('build-bom');
  try {
    const input = path.join(tmp, 'sky-blue-bom.json');
    fs.writeFileSync(input, '﻿' + JSON.stringify(exampleAsJson(path.join(EXAMPLES, 'sky-blue.js')), null, 2), 'utf8');
    buildAndCheck(input, 'sky-blue-bom.json');
  } finally {
    rmTmp(tmp);
  }
});

test('build.js exits non-zero when the scenario file is missing', () => {
  const tmp = makeTmp('build-missing');
  try {
    const r = run([BUILD, path.join(tmp, 'missing.json'), '-o', path.join(tmp, 'out.html')]);
    assert.notEqual(r.status, 0, r.output);
    assert.ok(!fs.existsSync(path.join(tmp, 'out.html')), 'no output should be written');
  } finally {
    rmTmp(tmp);
  }
});
