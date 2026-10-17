'use strict';
// validate.js warns when a scenario changes the background music too often (more than 4 changes) or on
// back-to-back slides. The engine carries the loop slide to slide; a change is a switch of the mood playing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SKILL_SCRIPTS, EXAMPLES, run, makeTmp, rmTmp, exampleFiles } = require('./helpers');

const VALIDATE = path.join(SKILL_SCRIPTS, 'validate.js');

// A plain one-speaker slide, shaped like the fixtures and examples.
function slide(id, extra = {}) {
  return {
    id,
    duration: 4,
    characters: [{ skin: 'whisker', at: 'left', expression: 'curious', pose: 'idle', say: `A short line for ${id}.` }],
    ...extra,
  };
}

// A dialogue block: its own id, extra fields (such as a block-level music) and two or more lines.
function block(id, lines, extra = {}) {
  return { id, ...extra, dialogue: { cast: { left: 'whisker', right: 'frog' }, lines } };
}

const talk = (who, say, extra = {}) => ({ who, say, ...extra });

function scenario(slides, music) {
  const sc = { title: 'Music test', defaults: { background: 'classroom', skin: 'whisker' }, slides };
  if (music !== undefined) sc.music = music;
  return sc;
}

// One plain slide per entry: a mood sets music on that slide, null leaves the field out.
function sceneMoods(moods) {
  return moods.map((m, i) => slide(`s${i}`, m === null ? {} : { music: m }));
}

// Writes the scenario to a temp JSON file, runs validate.js on it and returns the run result.
function validate(sc) {
  const tmp = makeTmp('music');
  try {
    const file = path.join(tmp, 'scenario.json');
    fs.writeFileSync(file, JSON.stringify(sc, null, 2), 'utf8');
    return run([VALIDATE, file]);
  } finally {
    rmTmp(tmp);
  }
}

// The WARN lines that mention music, in the order validate.js prints them.
const musicWarns = (output) => output.split(/\r?\n/).filter((l) => /^WARN\s+.*music/.test(l));

test('(a) three slides with calm and one switch to tense give no music warning', () => {
  const r = validate(scenario([slide('one'), slide('two', { music: 'tense' }), slide('three')], 'calm'));
  assert.equal(r.status, 0, r.output);
  assert.deepEqual(musicWarns(r.stdout), []);
});

test('(b) five real changes, spaced apart, give one music-count warning that names 5', () => {
  const moodAt = { 1: 'tense', 3: 'upbeat', 5: 'calm', 7: 'playful', 9: 'tense' };
  const slides = Array.from({ length: 11 }, (_, i) => slide(`s${i}`, moodAt[i] ? { music: moodAt[i] } : {}));
  const r = validate(scenario(slides, 'calm'));
  assert.equal(r.status, 0, r.output);
  const w = musicWarns(r.stdout);
  assert.equal(w.length, 1, r.output);
  assert.match(w[0], /music changes; 4 or fewer keeps each one meaningful/);
  assert.match(w[0], /^WARN\s+\(scenario\): 5 music changes;/);
});

test('(c) repeating the same mood on a slide is not counted as a change', () => {
  // 4 real changes (tense, upbeat, calm, playful); the other 7 slides repeat the mood already playing
  const r = validate(scenario(sceneMoods(['calm', 'calm', 'tense', 'tense', 'tense', 'upbeat', 'upbeat', 'calm', 'calm', 'calm', 'playful']), 'calm'));
  assert.equal(r.status, 0, r.output);
  assert.deepEqual(musicWarns(r.stdout), []);
});

test('(d) "none" then a mood counts as two changes', () => {
  // calm at the top; then three pairs of "none" and a mood: 6 changes in all
  const moods = [null, 'none', null, 'tense', null, 'none', null, 'upbeat', null, 'none', null, 'calm'];
  const r = validate(scenario(sceneMoods(moods), 'calm'));
  assert.equal(r.status, 0, r.output);
  const w = musicWarns(r.stdout);
  assert.equal(w.length, 1, r.output);
  assert.match(w[0], /^WARN\s+\(scenario\): 6 music changes;/);
});

test('(e) a change on the slide right after another change gets the "right after" warning', () => {
  const r = validate(scenario(sceneMoods([null, 'tense', 'upbeat']), 'calm'));
  assert.equal(r.status, 0, r.output);
  assert.deepEqual(musicWarns(r.stdout), [
    'WARN   slides[2]: music changes again right after slides[1]; give each mood a few slides',
  ]);
});

test('(f) line-level music in a dialogue block is counted and placed on the right line', () => {
  const slides = [
    slide('s0', { music: 'tense' }),                                        // change 1, slides[0]
    block('s1', [
      talk('left', 'Hello.'),
      talk('right', 'Hmm, a new mood.', { music: 'upbeat' }),               // change 2, lines[1]
      talk('left', 'Now calm.', { music: 'calm' }),                         // change 3, lines[2]: next to lines[1]
    ]),
    slide('s2'),
    slide('s3', { music: 'playful' }),                                      // change 4, slides[3]
    slide('s4'),
    slide('s5', { music: 'tense' }),                                        // change 5, slides[5]
  ];
  const r = validate(scenario(slides, 'calm'));
  assert.equal(r.status, 0, r.output);
  const w = musicWarns(r.stdout);
  assert.equal(w.length, 2, r.output);
  assert.ok(
    w.includes('WARN   slides[1].dialogue.lines[2]: music changes again right after slides[1].dialogue.lines[1]; give each mood a few slides'),
    r.output,
  );
  assert.ok(w.some((l) => /^WARN\s+\(scenario\): 5 music changes;/.test(l)), r.output);
});

test('(f2) a block-level music counts once, on its first line', () => {
  // the block's tense is change 1; the two lines after it do not add changes
  const slides = [
    block('s0', [talk('left', 'Hello.'), talk('right', 'Hi.')], { music: 'tense' }),
    slide('s1'),
    slide('s2', { music: 'upbeat' }),
    slide('s3'),
    slide('s4', { music: 'calm' }),
    slide('s5'),
    slide('s6', { music: 'playful' }),
    slide('s7'),
    slide('s8', { music: 'tense' }),
  ];
  const r = validate(scenario(slides, 'calm'));
  assert.equal(r.status, 0, r.output);
  const w = musicWarns(r.stdout);
  assert.equal(w.length, 1, r.output);
  assert.match(w[0], /^WARN\s+\(scenario\): 5 music changes;/);
});

test('(g) the shipped examples give no music warnings', () => {
  const found = [];
  for (const name of exampleFiles()) {
    const r = run([VALIDATE, path.join(EXAMPLES, name)]);
    for (const line of musicWarns(r.stdout)) found.push(`${name}: ${line}`);
  }
  assert.deepEqual(found, [], 'music warnings in the shipped examples');
});
