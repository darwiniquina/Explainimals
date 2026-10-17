'use strict';
// build-site.js makes the GitHub Pages site: six self-contained demo pages and a gallery that links to them.
// The site is built once into a temp folder; each test then checks one part of the result.
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, run, makeTmp, rmTmp, exampleFiles } = require('./helpers');

const SITE = path.join(ROOT, 'scripts', 'build-site.js');
const SVG_NS = 'http://www.w3.org/2000/svg';
const REPO_URL = 'https://github.com/darwiniquina/Explainimals';

// The demo ids: the example file names without extension, plus the sample scenario.
const DEMO_IDS = [...exampleFiles().map((f) => path.basename(f, '.js')), 'sleep-recharges-brain'].sort();

// Inline <script> blocks only (a block with a src attribute would fetch code, which the site must not do).
function inlineScripts(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!/\bsrc\s*=/i.test(m[1])) blocks.push(m[2]);
  }
  return blocks;
}

// Every href/src target written in the page, in order.
const attrTargets = (html) => [...html.matchAll(/\b(?:href|src)="([^"]*)"/gi)].map((m) => m[1]);

let OUT;
let first;

before(() => {
  OUT = makeTmp('site');
  first = run([SITE, OUT]);
});

after(() => {
  if (OUT) rmTmp(OUT);
});

test('build-site.js exits 0 and reports the six demos', () => {
  assert.equal(first.status, 0, first.output);
  for (const id of DEMO_IDS) {
    assert.match(first.stdout, new RegExp(`built\\s+${id}\\.html`), `no line for ${id}.html`);
  }
});

test('the site has six demo pages, index.html and .nojekyll', () => {
  for (const id of DEMO_IDS) {
    assert.ok(fs.existsSync(path.join(OUT, `${id}.html`)), `missing ${id}.html`);
  }
  assert.equal(DEMO_IDS.length, 6);
  assert.ok(fs.existsSync(path.join(OUT, 'index.html')), 'missing index.html');
  assert.ok(fs.existsSync(path.join(OUT, '.nojekyll')), 'missing .nojekyll');
  assert.equal(fs.statSync(path.join(OUT, '.nojekyll')).size, 0, '.nojekyll must be empty');
});

test('every demo page is self-contained and its inline scripts compile', () => {
  for (const id of DEMO_IDS) {
    const html = fs.readFileSync(path.join(OUT, `${id}.html`), 'utf8');
    const urls = html.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
    assert.deepEqual(urls.filter((u) => u !== SVG_NS), [], `${id}.html: external URL found`);
    assert.doesNotMatch(html, /<link\b/i, `${id}.html: <link> element found`);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, `${id}.html: external <script src> found`);

    const scripts = inlineScripts(html);
    assert.ok(scripts.length > 0, `${id}.html: no inline scripts found`);
    scripts.forEach((code, i) => {
      try {
        new vm.Script(code, { filename: `${id}-inline-${i}.js` });
      } catch (e) {
        assert.fail(`${id}.html: inline script ${i} does not compile: ${e.message}`);
      }
    });
  }
});

test('index.html links to every demo, and each link target exists', () => {
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  const targets = attrTargets(html);
  for (const id of DEMO_IDS) {
    assert.ok(targets.includes(`./${id}.html`), `index.html does not link to ${id}.html`);
  }
  for (const t of targets) {
    if (/^https?:\/\//i.test(t)) continue;   // checked below
    const file = path.join(OUT, t.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(file), `index.html links to ${t}, which does not exist`);
  }
});

test('index.html makes no external requests (only the repo link)', () => {
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script\b/i, 'index.html has a <script>');
  assert.doesNotMatch(html, /<link\b/i, 'index.html has a <link>');
  assert.doesNotMatch(html, /@import|url\(\s*["']?https?:/i, 'index.html loads a style from the internet');
  assert.doesNotMatch(html, /\bsrc\s*=\s*["']?https?:/i, 'index.html has an external src');
  const urls = [...new Set(html.match(/https?:\/\/[^\s"'<>)]+/gi) || [])];
  assert.deepEqual(urls, [REPO_URL], 'index.html should only link out to the repo');
  assert.match(html, /<title>Explainimals demos<\/title>/);
  assert.doesNotMatch(html, /[^\x00-\x7f]/, 'index.html text must be ASCII');
});

test('running the script twice into the same folder works', () => {
  const again = run([SITE, OUT]);
  assert.equal(again.status, 0, again.output);
  for (const id of DEMO_IDS) {
    assert.ok(fs.existsSync(path.join(OUT, `${id}.html`)), `missing ${id}.html after the second run`);
  }
  assert.ok(fs.existsSync(path.join(OUT, 'index.html')), 'missing index.html after the second run');
});
