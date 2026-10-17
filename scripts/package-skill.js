#!/usr/bin/env node
'use strict';
/*
 * package-skill.js - copies the presentation runtime and scenario examples from this workshop into the
 * plugin folder, regenerates the skill's catalog and validates every example.
 *
 *   node scripts/package-skill.js [--out <plugin folder path>]
 *
 * The workshop is the folder above this script. The default plugin folder is <workshop>/plugin (the folder that
 * contains skills/explainimals and .claude-plugin/plugin.json; the repo's .claude-plugin/marketplace.json points
 * at it). Steps:
 *   (a) runtime sync: character/ and presentation/ engine files into <skill>/runtime (nothing else)
 *   (b) examples sync: presentation/scenarios/*.js into <skill>/references/examples
 *   (c) catalog: node <skill>/scripts/catalog.js writes references/catalog.md
 *   (d) validate: node <skill>/scripts/validate.js on every example, PASS or FAIL each
 *   (e) summary and the total size of the skill folder
 *
 * It never touches SKILL.md, references/*.md (other than catalog.md, which catalog.js writes), the skill's
 * scripts or its assets. No npm packages.
 *
 * Exit codes: 0 every example passes and the catalog was written; 1 an example FAILs or the catalog step
 * failed; 2 bad arguments or a missing workshop or skill folder.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORKSHOP = path.resolve(__dirname, '..');
const DEFAULT_REPO = path.join(WORKSHOP, 'plugin');   // plugin/ is what the marketplace installs

// Runtime files that are copied. Everything else in the workshop (dashboard, archive, docs, html, scenarios)
// stays out of the skill. The skin files are found in the workshop, so a new skin is picked up automatically.
const PRESENTATION_FILES = [
  'pixel.js', 'registry.js', 'font.js', 'ui.js', 'backgrounds.js',
  'props.js', 'emotes.js', 'audio.js', 'engine.js',
].map((f) => `presentation/${f}`);

function allowedRuntime() {
  const charDir = path.join(WORKSHOP, 'character');
  if (!fs.existsSync(charDir)) throw new Error(`workshop has no character/ folder: ${charDir}`);
  const skins = fs.readdirSync(charDir).filter((f) => /^skin-.*\.js$/.test(f)).sort().map((f) => `character/${f}`);
  return ['character/parts.js', 'character/character.js', ...skins, ...PRESENTATION_FILES];
}

function parseArgs(argv) {
  let repo = DEFAULT_REPO;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') return { help: true };
    if (a === '--out') {
      if (i + 1 >= argv.length) throw new Error('--out needs a path');
      repo = argv[++i];
    } else if (a.startsWith('--out=')) {
      repo = a.slice('--out='.length);
    } else {
      throw new Error(`unknown argument ${a}`);
    }
  }
  return { repo: path.resolve(repo) };
}

// Every file under dir, as paths relative to dir with forward slashes.
function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function visit(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) visit(p);
      else if (ent.isFile()) out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  })(dir);
  return out.sort();
}

// Copies src to dest when the content differs. Returns 'updated', 'unchanged' or 'missing' (no source).
function syncFile(src, dest) {
  if (!fs.existsSync(src)) return 'missing';
  const next = fs.readFileSync(src);
  if (fs.existsSync(dest) && fs.readFileSync(dest).equals(next)) return 'unchanged';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, next);
  return 'updated';
}

function syncRuntime(skill, log) {
  const allowed = allowedRuntime();
  const rtDir = path.join(skill, 'runtime');
  const counts = { updated: 0, unchanged: 0, missing: 0, removed: 0 };

  for (const rel of allowed) {
    const status = syncFile(path.join(WORKSHOP, rel), path.join(rtDir, rel));
    counts[status] += 1;
    log(`  ${status.padEnd(9)} runtime/${rel}`);
  }

  // Anything left in the skill's runtime that is no longer on the allowed list goes.
  const allowedSet = new Set(allowed);
  for (const rel of listFiles(rtDir)) {
    if (allowedSet.has(rel)) continue;
    fs.unlinkSync(path.join(rtDir, rel));
    counts.removed += 1;
    log(`  removed   runtime/${rel}`);
  }
  return counts;
}

function syncExamples(skill, log) {
  const srcDir = path.join(WORKSHOP, 'presentation', 'scenarios');
  const destDir = path.join(skill, 'references', 'examples');
  if (!fs.existsSync(srcDir)) throw new Error(`workshop has no scenarios folder: ${srcDir}`);

  const names = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
  const counts = { updated: 0, unchanged: 0, missing: 0, extra: 0 };
  for (const name of names) {
    const status = syncFile(path.join(srcDir, name), path.join(destDir, name));
    counts[status] += 1;
    log(`  ${status.padEnd(9)} examples/${name}`);
  }
  // Examples that only exist in the skill are reported, not deleted.
  for (const rel of listFiles(destDir)) {
    if (!rel.endsWith('.js') || names.includes(rel)) continue;
    counts.extra += 1;
    log(`  extra     examples/${rel} (not in workshop, kept)`);
  }
  return { counts, destDir };
}

// Runs one of the skill's own Node scripts. Output is captured so the summary stays readable.
function runNode(script, args, cwd) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

function runCatalog(skill, log) {
  const script = path.join(skill, 'scripts', 'catalog.js');
  const r = runNode(script, [], skill);
  if (r.status !== 0) {
    log(`  catalog FAILED (exit ${r.status})`);
    log(indent(`${r.stdout || ''}${r.stderr || ''}`.trimEnd()));
    return false;
  }
  log(`  ${(r.stdout || '').trim() || 'catalog written'}`);
  return true;
}

function validateExamples(skill, examplesDir, log) {
  const script = path.join(skill, 'scripts', 'validate.js');
  const files = fs.readdirSync(examplesDir).filter((f) => f.endsWith('.js')).sort();
  const results = { pass: 0, fail: 0 };
  for (const name of files) {
    const r = runNode(script, [path.join(examplesDir, name)], skill);
    const ok = r.status === 0;
    results[ok ? 'pass' : 'fail'] += 1;
    log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
    const text = `${r.stdout || ''}${r.stderr || ''}`.trimEnd();
    if (text) log(indent(text));
  }
  return results;
}

function indent(text) {
  return text.split(/\r?\n/).map((l) => `        ${l}`).join('\n');
}

function sizeKB(dir) {
  const bytes = listFiles(dir).reduce((sum, rel) => sum + fs.statSync(path.join(dir, rel)).size, 0);
  return { kb: bytes / 1024, files: listFiles(dir).length };
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\nusage: node scripts/package-skill.js [--out <skill repo path>]`);
    return 2;
  }
  if (args.help) {
    console.log('usage: node scripts/package-skill.js [--out <skill repo path>]');
    return 0;
  }

  const skill = path.join(args.repo, 'skills', 'explainimals');
  if (!fs.existsSync(path.join(skill, 'SKILL.md'))) {
    console.error(`ERROR  skill folder not found (no SKILL.md): ${skill}`);
    return 2;
  }

  const log = (line) => console.log(line);
  let runtime, examples, catalogOk, validation;
  try {
    log('(a) runtime sync: workshop -> skill/runtime');
    runtime = syncRuntime(skill, log);

    log('(b) examples sync: workshop/presentation/scenarios -> skill/references/examples');
    examples = syncExamples(skill, log);

    log('(c) catalog: skill/references/catalog.md');
    catalogOk = runCatalog(skill, log);

    log('(d) validate every example');
    validation = validateExamples(skill, examples.destDir, log);
  } catch (e) {
    console.error(`ERROR  ${e.message}`);
    return 2;
  }

  const size = sizeKB(skill);
  const missing = [...(runtime.missing ? [`runtime: ${runtime.missing} allowed file(s) not in workshop`] : [])];
  console.log('');
  console.log('summary');
  console.log(`  runtime:   ${runtime.updated} updated, ${runtime.unchanged} unchanged, ${runtime.missing} missing, ${runtime.removed} removed`);
  console.log(`  examples:  ${examples.counts.updated} updated, ${examples.counts.unchanged} unchanged, ${examples.counts.extra} extra (kept)`);
  console.log(`  catalog:   ${catalogOk ? 'written' : 'FAILED'}`);
  console.log(`  validate:  ${validation.pass} PASS, ${validation.fail} FAIL`);
  for (const m of missing) console.log(`  WARNING:   ${m}`);
  console.log(`  skill:     ${size.kb.toFixed(1)} KB in ${size.files} files (${skill})`);

  return validation.fail > 0 || !catalogOk ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
