#!/usr/bin/env node
'use strict';
/*
 * build.js - turns one scenario into a single self-contained HTML file that plays offline.
 *
 *   node build.js <scenario.json | scenario.js> [-o out.html]
 *
 * The output is assets/player-template.html with every runtime script inlined (in the order the engine
 * needs) and the scenario inlined after them. Default output: next to the input, same name, .html.
 * A .json scenario is registered as window.Pres.scenarios['<slug of title>']; a .js scenario is inlined
 * as it is (it registers itself, like references/examples/*.js).
 *
 * No npm packages, no network. Exit codes: 0 written, 1 any error (usage, missing file, bad JSON).
 */
const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const TEMPLATE = path.join(SKILL_DIR, 'assets', 'player-template.html');
const RUNTIME_DIR = path.join(SKILL_DIR, 'runtime');

// Load order matters: each file expects the ones before it (see references/contract.md).
const RUNTIME_FILES = [
  'character/parts.js',
  'character/skin-penguin.js',
  'character/skin-frog.js',
  'character/skin-dog.js',
  'character/skin-whisker.js',
  'character/skin-rabbit.js',
  'character/skin-bear.js',
  'character/character.js',
  'presentation/pixel.js',
  'presentation/registry.js',
  'presentation/font.js',
  'presentation/ui.js',
  'presentation/backgrounds.js',
  'presentation/props.js',
  'presentation/emotes.js',
  'presentation/audio.js',
  'presentation/engine.js',
];

const MARK_RUNTIME = '<!--RUNTIME-->';
const MARK_SCENARIO = '<!--SCENARIO-->';

const USAGE = 'usage: node build.js <scenario.json | scenario.js> [-o out.html]';

class UsageError extends Error {}

function parseArgs(argv) {
  let input = null, out = null, help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') help = true;
    else if (a === '-o' || a === '--out') {
      if (i + 1 >= argv.length) throw new UsageError('-o needs a file name');
      out = argv[++i];
    } else if (a.startsWith('-')) {
      throw new UsageError(`unknown option ${a}`);
    } else {
      if (input !== null) throw new UsageError('give one scenario file');
      input = a;
    }
  }
  return { input, out, help };
}

// the same slug rule the dashboard uses for scenario ids: "How a website loads" -> "how-a-website-loads"
function slugOf(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'scenario';
}

// text placed inside a <script> element must not close it or open an HTML comment
function scriptSafe(text) {
  // keep the matched letters' case: the escape only adds a backslash, so string values stay exact
  return text.replace(/<\/(script)/gi, (m, word) => '<\\/' + word).replace(/<!--/g, '<\\!--');
}

function readText(file, what) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new Error(`cannot read ${what} ${file}: ${e.message}`);
  }
}

function runtimeTags() {
  return RUNTIME_FILES.map((rel) => {
    const file = path.join(RUNTIME_DIR, rel);
    const code = readText(file, 'runtime file');
    return `<script>\n// runtime/${rel}\n${scriptSafe(code)}\n</script>`;
  }).join('\n');
}

function scenarioTag(inputFile) {
  const ext = path.extname(inputFile).toLowerCase();
  const text = readText(inputFile, 'scenario');
  const name = path.basename(inputFile);
  if (ext === '.js') {
    return `<script>\n// scenario: ${name}\n${scriptSafe(text)}\n</script>`;
  }
  // .json: parse it first so a broken file fails here, not in the browser
  let obj;
  try {
    obj = JSON.parse(text.replace(/^﻿/, ''));   // Windows editors and PowerShell add a byte-order mark
  } catch (e) {
    throw new Error(`${name} is not valid JSON: ${e.message}`);
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${name}: a scenario must be a JSON object`);
  const key = slugOf(obj.title || path.basename(inputFile, ext));
  return '<script>\n' +
    `// scenario: ${name}\n` +
    'window.Pres = window.Pres || {};\n' +
    'window.Pres.scenarios = window.Pres.scenarios || {};\n' +
    `window.Pres.scenarios[${JSON.stringify(key)}] = ${scriptSafe(JSON.stringify(obj))};\n` +
    '</script>';
}

function build(input, outArg) {
  const inputFile = path.resolve(process.cwd(), input);
  if (!fs.existsSync(inputFile) || !fs.statSync(inputFile).isFile()) {
    throw new UsageError(`scenario file not found: ${inputFile}`);
  }
  const ext = path.extname(inputFile).toLowerCase();
  if (ext !== '.json' && ext !== '.js') throw new UsageError(`scenario must be a .json or .js file, got ${path.basename(inputFile)}`);

  const outFile = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.join(path.dirname(inputFile), path.basename(inputFile, path.extname(inputFile)) + '.html');

  const template = readText(TEMPLATE, 'template');
  const a = template.split(MARK_RUNTIME);
  if (a.length !== 2) throw new Error(`template must contain ${MARK_RUNTIME} exactly once`);
  const b = a[1].split(MARK_SCENARIO);
  if (b.length !== 2) throw new Error(`template must contain ${MARK_SCENARIO} exactly once`);

  // built in one pass from pieces, so inlined code is never scanned for markers
  const html = a[0] + runtimeTags() + b[0] + scenarioTag(inputFile) + b[1];
  if (html.includes(MARK_RUNTIME) || html.includes(MARK_SCENARIO)) throw new Error('a marker was left in the output');

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  const size = fs.statSync(outFile).size;
  console.log(`wrote ${outFile} (${(size / 1024).toFixed(1)} KB)`);
  return outFile;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`error: ${e.message}`);
    console.error(USAGE);
    process.exit(1);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (args.input === null) {
    console.error('error: missing scenario file');
    console.error(USAGE);
    process.exit(1);
  }
  try {
    build(args.input, args.out);
  } catch (e) {
    console.error(`error: ${e.message}`);
    if (e instanceof UsageError) console.error(USAGE);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { build, scriptSafe, slugOf, RUNTIME_FILES };
