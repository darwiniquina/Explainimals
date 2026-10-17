'use strict';
// The player's slide thumbnail strip: the built file must carry the strip where the template puts it, its
// script must compile, and the shipped examples must still build with it. node:test runs without a browser,
// so the behaviour itself (frames copied onto the canvases, clicks, the highlight) is not run here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  SKILL, SKILL_SCRIPTS, EXAMPLES, run, makeTmp, rmTmp, exampleAsJson, exampleFiles,
} = require('./helpers');

const BUILD = path.join(SKILL_SCRIPTS, 'build.js');
const VALIDATE = path.join(SKILL_SCRIPTS, 'validate.js');
const TEMPLATE = path.join(SKILL, 'assets', 'player-template.html');
const SVG_NS = 'http://www.w3.org/2000/svg';

// Inline <script> blocks only, the same rule build.test.js uses.
function inlineScripts(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!/\bsrc\s*=/i.test(m[1])) blocks.push(m[2]);
  }
  return blocks;
}

// Builds `input` with build.js and returns the HTML text. `label` names the case in failures.
function buildHtml(input, label) {
  const tmp = makeTmp('thumbs');
  try {
    const out = path.join(tmp, 'out', 'explainer.html');
    const r = run([BUILD, input, '-o', out]);
    assert.equal(r.status, 0, `${label}: build.js exited ${r.status}: ${r.output}`);
    assert.ok(fs.existsSync(out), `${label}: no HTML written`);
    return fs.readFileSync(out, 'utf8');
  } finally {
    rmTmp(tmp);
  }
}

// A scenario JSON with its first `count` slides of the sky-blue example, written into a temp folder.
// The file is checked with validate.js first, so a failing build below is never a bad scenario.
function sliceScenario(count, title) {
  const tmp = makeTmp('thumbs-scenario');
  try {
    const sc = exampleAsJson(path.join(EXAMPLES, 'sky-blue.js'));
    const input = path.join(tmp, `${title.toLowerCase().replace(/\s+/g, '-')}.json`);
    fs.writeFileSync(input, JSON.stringify({ ...sc, title, slides: sc.slides.slice(0, count) }, null, 2), 'utf8');
    const v = run([VALIDATE, input]);
    assert.equal(v.status, 0, `${title}: validate.js reports errors: ${v.output}`);
    return buildHtml(input, title);
  } finally {
    rmTmp(tmp);
  }
}

function assertSelfContained(html, label) {
  const urls = html.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
  assert.deepEqual(urls.filter((u) => u !== SVG_NS), [], `${label}: the output must be self-contained, found URLs`);
}

function assertScriptsCompile(html, label) {
  const scripts = inlineScripts(html);
  assert.ok(scripts.length > 0, `${label}: no inline scripts found`);
  scripts.forEach((code, i) => {
    try {
      new vm.Script(code, { filename: `${label}-inline-${i}.js` });
    } catch (e) {
      assert.fail(`${label}: inline script ${i} does not compile: ${e.message}`);
    }
  });
}

test('the template puts the thumbnail strip under the progress bar and above the controls row', () => {
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  const bar = tpl.indexOf('class="bar"');
  const strip = tpl.indexOf('id="thumbs"');
  const controls = tpl.indexOf('class="controls"');
  assert.ok(bar >= 0 && strip >= 0 && controls >= 0, 'bar, thumbs and controls must all be in the template');
  assert.ok(bar < strip && strip < controls, 'the strip must sit between the bar and the controls');
  const stripTag = tpl.slice(strip, tpl.indexOf('>', strip));
  assert.match(stripTag, /class="thumbs"/, 'the strip container keeps its class');
  assert.match(stripTag, /\bhidden\b/, 'the strip starts hidden and is shown only when there are two or more slides');
});

test('a built file carries the thumbnail strip, its styles and its script', () => {
  const html = sliceScenario(3, 'Three Slides');
  assert.match(html, /<div id="thumbs" class="thumbs"[^>]*>/, 'the strip container is missing from the output');
  assert.match(html, /\.thumbs \{/, 'the strip styles are missing from the output');
  assert.ok(html.includes('function buildThumbs(scenario)'), 'the strip script is missing from the output');
  assert.ok(html.includes('buildThumbs(scenario);'), 'the strip is never started from boot');
  assert.ok(html.includes('Click a thumbnail to jump to a slide'), 'the hint line does not mention the strip');
});

test('the built file with the thumbnail strip is self-contained and every inline script compiles', () => {
  const html = sliceScenario(3, 'Three Slides');
  assert.ok(!html.includes('<!--RUNTIME-->') && !html.includes('<!--SCENARIO-->'), 'a marker was left in the output');
  assertSelfContained(html, 'three slides');
  assertScriptsCompile(html, 'three slides');
});

test('a one-slide scenario still builds with the strip in place (the strip stays hidden at run time)', () => {
  const html = sliceScenario(1, 'One Slide');
  assert.match(html, /<div id="thumbs" class="thumbs"[^>]*>/, 'the strip container is missing from the output');
  assertSelfContained(html, 'one slide');
  assertScriptsCompile(html, 'one slide');
});

test('the 5 example scenarios still build, with the strip, into self-contained files that compile', () => {
  const names = exampleFiles();
  assert.equal(names.length, 5, `expected 5 examples, found ${names.length}: ${names.join(', ')}`);
  for (const name of names) {
    const html = buildHtml(path.join(EXAMPLES, name), name);
    assert.match(html, /<div id="thumbs" class="thumbs"[^>]*>/, `${name}: the strip container is missing`);
    assertSelfContained(html, name);
    assertScriptsCompile(html, name);
  }
});
