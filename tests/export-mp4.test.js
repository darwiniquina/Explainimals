'use strict';
// The MP4 export script (scripts/export_mp4.py): its file and command line, the docs that point at it, and an
// opt-in end-to-end run. The default tests need only Python 3, not playwright or ffmpeg.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, SKILL, SKILL_SCRIPTS, readText, run, rmTmp } = require('./helpers');

const SCRIPT = path.join(SKILL_SCRIPTS, 'export_mp4.py');
const BUILD = path.join(SKILL_SCRIPTS, 'build.js');
const SKILL_MD = path.join(SKILL, 'SKILL.md');
const MP4_OPT_IN = process.env.EXPLAINIMALS_TEST_MP4 === '1';

// The first Python 3 that answers --version. Windows often has a "python" that is only the Store stub, so each
// candidate is run, not just looked up on PATH.
const PYTHONS = [{ cmd: 'python', pre: [] }, { cmd: 'python3', pre: [] }, { cmd: 'py', pre: ['-3'] }];
function findPython() {
  for (const p of PYTHONS) {
    const r = spawnSync(p.cmd, [...p.pre, '--version'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    if (r.status === 0 && /Python 3\./.test(`${r.stdout || ''}${r.stderr || ''}`)) return p;
  }
  return null;
}
const PY = findPython();

// Options for a test that needs Python: it is skipped, with a reason, when no Python 3 is on PATH.
const needsPy = (opts = {}) => ({ ...opts, skip: PY ? false : 'no python on PATH' });

// Runs the script with the Python that was found. Output is captured, never inherited.
function py(args, opts = {}) {
  const r = spawnSync(PY.cmd, [...PY.pre, ...args], {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    timeout: opts.timeout || 60000,
    windowsHide: true,
    env: opts.env || process.env,
  });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  return { status: r.status, stdout, stderr, output: stdout + stderr };
}

// A fresh folder under the OS temp directory for one test. Pair with rmTmp() in a finally block.
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'exp-mp4-'));

// -------------------------------------------------------------- the file itself

test('export_mp4.py exists, starts with a python3 shebang, and contains only ASCII', () => {
  assert.ok(fs.statSync(SCRIPT).isFile(), `${SCRIPT} is missing`);
  assert.equal(readText(SCRIPT).split(/\r?\n/)[0], '#!/usr/bin/env python3');
  const bytes = fs.readFileSync(SCRIPT);
  const at = bytes.findIndex((b) => b > 127);
  assert.equal(at, -1, `non-ASCII byte ${bytes[at]} at offset ${at}`);
});

test('the script compiles with py_compile, without creating __pycache__ inside scripts/', needsPy(), () => {
  const tmp = tmpDir();
  try {
    const before = fs.existsSync(path.join(SKILL_SCRIPTS, '__pycache__'));
    const env = { ...process.env, PYTHONPYCACHEPREFIX: path.join(tmp, 'pycache') };
    const r = py(['-m', 'py_compile', SCRIPT], { env });
    assert.equal(r.status, 0, r.output);
    assert.equal(fs.existsSync(path.join(SKILL_SCRIPTS, '__pycache__')), before, 'a __pycache__ folder appeared in scripts/');
  } finally {
    rmTmp(tmp);
  }
});

// -------------------------------------------------------------- the command line (no playwright or ffmpeg needed)

test('--help exits 0 and mentions --width, --check and --no-audio', needsPy(), () => {
  const r = py([SCRIPT, '--help']);
  assert.equal(r.status, 0, r.output);
  for (const flag of ['--width', '--check', '--no-audio']) {
    assert.ok(r.stdout.includes(flag), `--help does not mention ${flag}`);
  }
});

test('no arguments exits 2 with an error on stderr', needsPy(), () => {
  const r = py([SCRIPT]);
  assert.equal(r.status, 2, r.output);
  assert.match(r.stderr, /error:/);
});

test('a missing file, or a file that is not .html, exits 2 with an error and no traceback', needsPy(), () => {
  const tmp = tmpDir();
  try {
    const txt = path.join(tmp, 'notes.txt');
    fs.writeFileSync(txt, 'not a presentation\n');
    for (const file of [path.join(tmp, 'missing.html'), txt]) {
      const name = path.basename(file);
      const r = py([SCRIPT, file]);
      assert.equal(r.status, 2, `${name}: ${r.output}`);
      assert.match(r.stderr, /error:/, name);
      assert.doesNotMatch(r.stderr, /Traceback/, name);
    }
  } finally {
    rmTmp(tmp);
  }
});

test('--width 1000 is rejected by argparse with exit 2', needsPy(), () => {
  const tmp = tmpDir();
  try {
    const html = path.join(tmp, 'x.html');
    fs.writeFileSync(html, '<!doctype html><title>x</title>\n');
    const r = py([SCRIPT, '--width', '1000', html]);
    assert.equal(r.status, 2, r.output);
    assert.match(r.stderr, /--width/);
  } finally {
    rmTmp(tmp);
  }
});

test('--check prints an "ffmpeg:" or "missing:" line (its exit code depends on the machine, so it is not asserted)', needsPy({ timeout: 120000 }), () => {
  const r = py([SCRIPT, '--check'], { timeout: 120000 });
  assert.match(r.output, /^(ffmpeg|missing):/m, r.output);
});

// -------------------------------------------------------------- the docs that send an agent to the script

test('SKILL.md names the script, --check, the MP4 reference, the install command, and MP4', () => {
  const md = readText(SKILL_MD);
  for (const text of ['scripts/export_mp4.py', '--check', 'references/mp4.md', 'pip install playwright imageio-ffmpeg', 'MP4']) {
    assert.ok(md.includes(text), `SKILL.md does not mention ${text}`);
  }
});

test('SKILL.md says the agent must ask before installing anything', () => {
  assert.ok(readText(SKILL_MD).includes('ask before installing'), 'SKILL.md does not say "ask before installing"');
});

test('references/mp4.md exists', () => {
  const file = path.join(SKILL, 'references', 'mp4.md');
  assert.ok(fs.existsSync(file), `${path.relative(ROOT, file)} is missing`);
});

test('every references/ path named in SKILL.md exists (paths with a * are skipped)', () => {
  const named = [...readText(SKILL_MD).matchAll(/`(references\/[^`\s]+)`/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes('*'));
  assert.ok(named.length >= 5, `expected several references/ paths in SKILL.md, found ${named.length}`);
  const missing = named.filter((p) => !fs.existsSync(path.join(SKILL, p)));
  assert.deepEqual(missing, []);
});

// -------------------------------------------------------------- opt-in: a real export (EXPLAINIMALS_TEST_MP4=1)

test('integration: a one-slide presentation exports to an MP4 (needs playwright, ffmpeg and Chrome or Edge)', {
  timeout: 240000,
  skip: !MP4_OPT_IN
    ? 'set EXPLAINIMALS_TEST_MP4=1 to run (needs playwright, ffmpeg and Chrome or Edge)'
    : (PY ? false : 'no python on PATH'),
}, () => {
  const dir = tmpDir();
  try {
    const json = path.join(dir, 'tone.json');
    const html = path.join(dir, 'tone.html');
    const mp4 = path.join(dir, 'tone.mp4');
    const scenario = { title: 'Tone', finale: 'none', slides: [{ id: 'a', duration: 2, title: { text: 'Hi' } }] };
    fs.writeFileSync(json, JSON.stringify(scenario, null, 2) + '\n');

    const built = run([BUILD, json, '-o', html]);
    assert.equal(built.status, 0, built.output);

    const r = py([SCRIPT, html, '--width', '960', '--hold', '0.2'], { timeout: 240000 });
    assert.equal(r.status, 0, r.output);
    assert.ok(fs.existsSync(mp4), `no MP4 written next to the html: ${r.output}`);

    const bytes = fs.readFileSync(mp4);
    assert.ok(bytes.length > 5000, `MP4 is only ${bytes.length} bytes`);
    assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp');
  } finally {
    rmTmp(dir);
  }
});
