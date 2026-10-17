'use strict';
// Shared helpers for the test suite. Only Node built-ins: no npm packages, no network.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(ROOT, 'plugin');
const SKILL = path.join(PLUGIN, 'skills', 'explainimals');
const SKILL_RUNTIME = path.join(SKILL, 'runtime');
const SKILL_SCRIPTS = path.join(SKILL, 'scripts');
const EXAMPLES = path.join(SKILL, 'references', 'examples');
const WORKSHOP_CHARACTER = path.join(ROOT, 'character');
const WORKSHOP_PRESENTATION = path.join(ROOT, 'presentation');
const WORKSHOP_SCENARIOS = path.join(WORKSHOP_PRESENTATION, 'scenarios');
const FIXTURES = path.join(__dirname, 'fixtures');

// The engine loader lives in the skill; tests use the same copy the users get.
const { createRuntime } = require(path.join(SKILL_SCRIPTS, 'lib', 'load-runtime'));

// Git and Windows editors may store text with CRLF; compare the content, not the line endings.
const eol = (s) => s.replace(/\r\n/g, '\n');
const readText = (file) => fs.readFileSync(file, 'utf8');
const readNormalised = (file) => eol(readText(file));

// Runs `node <args>` with the same interpreter as the test runner. Output is captured, never inherited.
function run(args, opts = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    timeout: opts.timeout || 60000,
    windowsHide: true,
  });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  return { status: r.status, signal: r.signal, stdout, stderr, output: stdout + stderr, error: r.error };
}

// A fresh directory under the OS temp folder. Pair with rmTmp() in a finally block.
function makeTmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `explainimals-${label}-`));
}

function rmTmp(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Every file under dir (recursive), as absolute paths, sorted.
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

// Forward-slash path relative to base, so lists compare the same on Windows and POSIX.
const relPosix = (base, file) => path.relative(base, file).split(path.sep).join('/');

// Evaluates an example scenario file (a classic script that sets window.Pres.scenarios[id]) in a fresh
// runtime. Returns the single scenario and the runtime, the same way validate.js reads a .js scenario.
function loadScenarioScript(file) {
  const rt = createRuntime();
  vm.runInContext(readText(file), rt.context, { filename: file });
  const ids = Object.keys(rt.Pres.scenarios || {});
  if (ids.length !== 1) throw new Error(`${file}: expected one scenario, found ${ids.length}`);
  return { id: ids[0], scenario: rt.Pres.scenarios[ids[0]], rt };
}

// A scenario as plain JSON data (what a user writes), taken from an example's object.
function exampleAsJson(file) {
  return JSON.parse(JSON.stringify(loadScenarioScript(file).scenario));
}

// Scenario ids in the examples folder, sorted, with the file names.
function exampleFiles() {
  return fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.js')).sort();
}

module.exports = {
  ROOT,
  PLUGIN,
  SKILL,
  SKILL_RUNTIME,
  SKILL_SCRIPTS,
  EXAMPLES,
  WORKSHOP_CHARACTER,
  WORKSHOP_PRESENTATION,
  WORKSHOP_SCENARIOS,
  FIXTURES,
  eol,
  readText,
  readNormalised,
  run,
  makeTmp,
  rmTmp,
  walk,
  relPosix,
  loadScenarioScript,
  exampleAsJson,
  exampleFiles,
  createRuntime,
};
