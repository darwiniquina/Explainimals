#!/usr/bin/env node
'use strict';
/*
 * build-site.js - builds the sample explainers into a static site (GitHub Pages serves the result).
 *
 *   node scripts/build-site.js [outDir]        (default outDir: _site in the repo root)
 *
 * Each demo is one HTML file, built by the skill's own build.js: <outDir>/<id>.html, where id is the
 * example's file name without extension. The gallery is <outDir>/index.html. A preview image at
 * docs/previews/<id>.png is copied to <outDir>/previews/<id>.png and shown on the card when it exists.
 * Title, slide count and length come from the engine (Pres.normalizeScenario), not from the files.
 *
 * No npm packages, no network. Exit codes: 0 site written, 1 a demo failed (index.html is then not written).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { createRuntime } = require('../plugin/skills/explainimals/scripts/lib/load-runtime');

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(ROOT, 'plugin', 'skills', 'explainimals');
const BUILD = path.join(SKILL, 'scripts', 'build.js');
const EXAMPLES = path.join(SKILL, 'references', 'examples');
const SAMPLES = path.join(ROOT, 'samples');
const PREVIEWS = path.join(ROOT, 'docs', 'previews');
const REPO_URL = 'https://github.com/darwiniquina/Explainimals';

// One line per demo, keyed by id. A demo with no entry gets no description line (never a build failure).
const BLURBS = {
  'code-review-chat': 'A playful dev chat about a pull request, with all six characters in three scenes.',
  'how-claude-works-cinematic': 'How Claude turns your words into an answer, with camera moves and transitions.',
  'how-claude-works': 'A short tour of how Claude reads your message and predicts a reply.',
  'sky-blue': 'Whisker asks why the sky is blue, and Frog explains how sunlight scatters at sunset.',
  'web-trip': 'Follow one page from typing an address to the page appearing on your screen.',
  'sleep-recharges-brain': 'Why sleep lets your brain clear out the day and recharge for the next one.',
};

// The demo sources: every examples/*.js (sorted), then the sample scenario.
function demoSources() {
  const examples = fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(EXAMPLES, f));
  return [...examples, path.join(SAMPLES, 'sleep-recharges-brain.json')];
}

// Reads the scenario the way the engine does and returns its title, slide count and length in seconds.
// A .js file registers itself on window.Pres.scenarios; a .json file is the scenario object itself.
function measure(file) {
  const rt = createRuntime();
  let scenario;
  if (path.extname(file).toLowerCase() === '.json') {
    scenario = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));   // BOM from Windows editors
  } else {
    vm.runInContext(fs.readFileSync(file, 'utf8'), rt.context, { filename: file });
    const ids = Object.keys(rt.Pres.scenarios || {});
    if (ids.length !== 1) throw new Error(`expected one scenario, found ${ids.length}`);
    scenario = rt.Pres.scenarios[ids[0]];
  }
  const report = rt.Pres.validate(scenario);
  if (report.errors.length) throw new Error(`invalid scenario: ${report.errors[0]}`);
  const sc = rt.Pres.normalizeScenario(scenario);
  return { title: sc.title || path.basename(file), slides: sc.slides.length, seconds: Math.round(sc.total) };
}

// Runs build.js for one demo. Its own output is kept quiet; a failure carries its message.
function buildDemo(file, outFile) {
  const r = spawnSync(process.execPath, [BUILD, file, '-o', outFile], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(((r.stderr || '') + (r.stdout || '')).trim() || `build.js exited ${r.status}`);
}

// Text for HTML: escapes markup and turns anything outside printable ASCII into an entity, so the page stays ASCII.
function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7e]/g, (c) => `&#${c.codePointAt(0)};`);
}

const STYLE = `
  :root {
    --bg: #0b0912; --panel: #161225; --line: #3a3358; --text: #ece8f8; --muted: #8e87ad;
    --accent: #f5c04f; --accent-ink: #1b1407; --accent2: #7fd6c8;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
  body { font: 14px/1.45 ui-monospace, Consolas, "Cascadia Mono", "Courier New", monospace; min-height: 100vh; }
  .app { max-width: 1040px; margin: 0 auto; padding: 16px; overflow-wrap: anywhere; }
  h1 { margin: 8px 0 6px; font-size: 22px; letter-spacing: 0.04em; }
  .lead { margin: 0 0 6px; }
  .repo { color: var(--accent2); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; margin-top: 22px; }
  .card { display: flex; flex-direction: column; background: var(--panel); border: 2px solid var(--line);
    box-shadow: 3px 3px 0 #000; padding: 12px 14px; }
  .card:hover { border-color: var(--accent2); }
  .shot { display: block; margin: -12px -14px 12px; border-bottom: 2px solid var(--line); }
  .shot img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; image-rendering: pixelated; }
  .card h2 { margin: 0 0 4px; font-size: 16px; }
  .meta { margin: 0 0 8px; color: var(--muted); font-size: 12px; }
  .desc { margin: 0 0 14px; flex: 1; }
  .btn { align-self: flex-start; color: var(--accent-ink); background: var(--accent); border: 2px solid var(--accent);
    padding: 6px 14px; font-weight: bold; text-decoration: none; box-shadow: 3px 3px 0 #000; }
  .btn:hover { border-color: #fff3c4; }
  .btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #000; }
  a:focus-visible { outline: 2px solid var(--accent2); outline-offset: 2px; }
`;

// The gallery page. Demo names are the file names built above; the image path is only used when it exists.
function galleryHtml(cards) {
  const items = cards.map((c) => {
    const shot = c.preview
      ? `\n      <a class="shot" href="./${esc(c.id)}.html"><img src="./previews/${esc(c.id)}.png" alt="Preview of ${esc(c.title)}" loading="lazy"></a>`
      : '';
    const desc = c.blurb ? `\n      <p class="desc">${esc(c.blurb)}</p>` : '';
    return `    <article class="card">${shot}
      <h2>${esc(c.title)}</h2>
      <p class="meta">${c.slides} slides, ${c.seconds} s</p>${desc}
      <a class="btn" href="./${esc(c.id)}.html">Open</a>
    </article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Explainimals demos</title>
<style>${STYLE}</style>
</head>
<body>
<main class="app">
  <h1>Explainimals demos</h1>
  <p class="lead">Animated explainers made by the Explainimals skill. Each one is a single HTML file: open it and press Play.</p>
  <p class="lead">Source: <a class="repo" href="${REPO_URL}">${REPO_URL}</a></p>
  <section class="grid">
${items}
  </section>
</main>
</body>
</html>
`;
}

function main(argv) {
  const outDir = path.resolve(process.cwd(), argv[0] || path.join(ROOT, '_site'));
  fs.mkdirSync(outDir, { recursive: true });

  const cards = [];
  let failed = 0;
  for (const file of demoSources()) {
    const id = path.basename(file, path.extname(file));
    try {
      const info = measure(file);
      const outFile = path.join(outDir, `${id}.html`);
      buildDemo(file, outFile);
      const preview = path.join(PREVIEWS, `${id}.png`);
      const hasPreview = fs.existsSync(preview);
      if (hasPreview) {
        fs.mkdirSync(path.join(outDir, 'previews'), { recursive: true });
        fs.copyFileSync(preview, path.join(outDir, 'previews', `${id}.png`));
      }
      cards.push({ id, ...info, blurb: BLURBS[id] || '', preview: hasPreview });
      console.log(`built  ${id}.html  "${info.title}"  ${info.slides} slides  ${info.seconds} s`);
    } catch (e) {
      failed += 1;
      console.error(`FAILED ${id}: ${e.message}`);
    }
  }

  if (failed) {
    console.error(`${failed} demo(s) failed; index.html was not written.`);
    return 1;
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), galleryHtml(cards), 'utf8');
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');
  console.log(`built  index.html  (${cards.length} demos)`);
  console.log(`site written to ${outDir}: ${cards.length} demos, 0 failed`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { demoSources, measure, esc, galleryHtml };
