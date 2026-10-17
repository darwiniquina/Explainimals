'use strict';
// The finale: the last slide of a 2+ slide scenario plays the celebrate fanfare unless it sets its own music.
// Audio output is replaced by recorders, so the tests check which mood each slide asks for, not the sound.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SKILL_RUNTIME, SKILL_SCRIPTS, EXAMPLES, exampleFiles, loadScenarioScript, createRuntime, run } = require('./helpers');

const VALIDATE = path.join(SKILL_SCRIPTS, 'validate.js');

// Arrays and objects made inside the runtime's vm context have another Array prototype; a JSON copy fixes that.
const plain = (v) => JSON.parse(JSON.stringify(v));

// A title-card slide: no characters, so a Player can run it without a real DOM.
const card = (id, extra = {}) => ({ id, duration: 4, title: { text: `Card ${id}` }, ...extra });

// A dialogue block of two or more lines (the cast is whisker on the left and frog on the right).
const talk = (who, say, extra = {}) => ({ who, say, ...extra });
const block = (id, lines, extra = {}) => ({ id, ...extra, dialogue: { cast: { left: 'whisker', right: 'frog' }, lines } });

// A scenario with the given slides; top-level fields such as music or finale are merged in.
const scenario = (slides, extra = {}) => ({ title: 'Finale test', defaults: { background: 'classroom', skin: 'whisker' }, slides, ...extra });

// The music of every slide after normalisation, as a Player would see it.
const musicOf = (sc) => plain(createRuntime().Pres.normalizeScenario(sc).slides.map((s) => s.music));

// Plays the scenario: play() starts the first slide, then each seek enters a slide while playing.
// Returns every mood the audio module was asked for, in order (null means silence).
function playCalls(sc, visits) {
  const rt = createRuntime();
  const P = rt.Pres;
  rt.window.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  const calls = [];
  P.audio.supported = true;
  P.audio.unlock = () => {};
  P.audio.music = (name) => { calls.push(name); };
  P.audio.stopMusic = () => { calls.push('stop'); };
  const player = new P.Player(rt.window.document.createElement('div'), { audio: true });
  player.load(sc);
  player.play();
  visits.forEach((i) => player.seek(i));
  return calls;
}

// Validation report of a scenario in a fresh runtime (audio.js loaded, so mood names are checked).
const report = (sc) => plain(createRuntime().Pres.validate(sc));

// -------------------------------------------------------------- audio: the celebrate track

// audio.js loaded into its own context with a fake AudioContext, so the scheduler really runs and the notes can
// be inspected. Every note is an oscillator; the interval the track sets up is captured instead of run.
function fakeAudio() {
  const intervals = [];
  const oscillators = [];
  const contexts = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  class FakeContext {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = {}; contexts.push(this); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const o = { type: 'sine', freqs: [], frequency: param(), detune: param(), connect() {}, start() {}, stop() {} };
      o.frequency.setValueAtTime = (f) => { o.freqs.push(f); };
      oscillators.push(o);
      return o;
    }
  }
  const sandbox = {
    AudioContext: FakeContext,
    setInterval(fn) { const h = { fn: fn, cleared: false }; intervals.push(h); return h; },
    clearInterval(h) { if (h) h.cleared = true; },
    setTimeout() { return 0; },
    clearTimeout() {},
    console,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SKILL_RUNTIME, 'presentation', 'audio.js'), 'utf8'), sandbox, { filename: 'audio.js' });
  return { audio: sandbox.Pres.audio, contexts, intervals, oscillators };
}

// MIDI note number of a frequency (A4 = 69).
const midiOf = (f) => Math.round(69 + 12 * Math.log2(f / 440));
const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

test('audio catalog lists five moods, celebrate last, with its bpm', () => {
  const { Pres } = createRuntime();
  const music = plain(Pres.audio.catalog().music);
  assert.deepEqual(music.map((m) => m.id), ['calm', 'upbeat', 'tense', 'playful', 'celebrate']);
  assert.deepEqual(music.find((m) => m.id === 'celebrate'), { id: 'celebrate', label: 'Celebrate', bpm: 145 });
  assert.deepEqual(music.slice(0, 4).map((m) => m.bpm), [78, 150, 118, 132], 'the other four moods are unchanged');
});

test('audio: celebrate schedules a C-major fanfare that climbs to a high tonic, and stops cleanly', () => {
  const a = fakeAudio();
  a.audio.unlock();
  a.audio.music('celebrate');
  assert.equal(a.audio.nowPlaying(), 'celebrate');

  // advance the clock so the scheduler plans one whole 16-step loop, then run the interval once
  a.contexts[0].currentTime = 3.5;
  a.intervals[0].fn();

  const leads = a.oscillators.filter((o) => o.type === 'square').flatMap((o) => o.freqs.map(midiOf));
  const bass = a.oscillators.filter((o) => o.type === 'triangle').flatMap((o) => o.freqs.map(midiOf));
  assert.ok(leads.length >= 15, `lead notes scheduled: ${leads.length}`);
  for (const m of leads) assert.ok(C_MAJOR.has(((m % 12) + 12) % 12), `lead note ${m} is outside C major`);
  for (const m of bass) assert.ok([48, 53, 55, 57].includes(m), `bass note ${m} is not C3, F3, G3 or A3`);
  assert.equal(Math.min(...leads), 60, 'the lead starts on C4');
  assert.equal(Math.max(...leads), 84, 'the lead lands on the high tonic C6');

  a.audio.music('calm');
  assert.equal(a.audio.nowPlaying(), 'calm', 'switching from celebrate to another mood works');
  a.audio.stopMusic();
  assert.equal(a.audio.nowPlaying(), null);
  assert.equal(a.intervals[0].cleared, true, 'the scheduler is cleared on stop');
});

// -------------------------------------------------------------- playback: which mood each slide asks for

test('by default the last slide of a 3-slide scenario plays celebrate and the earlier slides keep the loop', () => {
  const sc = scenario([card('a'), card('b'), card('c')], { music: 'calm' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'celebrate']);
  assert.deepEqual(playCalls(sc, [1, 2]), ['calm', 'calm', 'celebrate']);
});

test('"celebrate" written as the finale is the same as leaving it out', () => {
  const sc = scenario([card('a'), card('b'), card('c')], { music: 'calm', finale: 'celebrate' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'celebrate']);
  assert.equal(report(sc).warnings.filter((w) => /finale/.test(w)).length, 0);
});

test('finale "none" gives silence on the last slide', () => {
  const sc = scenario([card('a'), card('b'), card('c')], { music: 'calm', finale: 'none' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', null]);
  assert.deepEqual(playCalls(sc, [1, 2]), ['calm', 'calm', null]);
});

test('finale "keep" leaves the loop playing on the last slide', () => {
  const sc = scenario([card('a'), card('b'), card('c')], { music: 'calm', finale: 'keep' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'calm']);
  assert.deepEqual(playCalls(sc, [1, 2]), ['calm', 'calm', 'calm']);
});

test('finale set to a mood id plays that mood on the last slide', () => {
  const sc = scenario([card('a'), card('b'), card('c')], { music: 'calm', finale: 'upbeat' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'upbeat']);
  assert.deepEqual(playCalls(sc, [1, 2]), ['calm', 'calm', 'upbeat']);
});

test('the last slide with its own music wins over the finale, and the finale then gets a warning', () => {
  const sc = scenario([card('a'), card('b'), card('c', { music: 'tense' })], { music: 'calm', finale: 'celebrate' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'tense']);
  assert.deepEqual(playCalls(sc, [1, 2]), ['calm', 'calm', 'tense']);
  assert.ok(report(sc).warnings.includes('finale: ignored, the last slide sets its own music'), JSON.stringify(report(sc)));
});

test('an explicit "none" on the last slide is its own music too: the finale is ignored', () => {
  const sc = scenario([card('a'), card('b'), card('c', { music: 'none' })], { music: 'calm' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', null]);
  assert.deepEqual(report(sc).warnings, []);
  const withFinale = scenario([card('a'), card('b'), card('c', { music: 'none' })], { music: 'calm', finale: 'celebrate' });
  assert.deepEqual(musicOf(withFinale), ['calm', 'calm', null]);
  assert.ok(report(withFinale).warnings.includes('finale: ignored, the last slide sets its own music'));
});

test('without scenario music the default finale starts the ending from silence; a one-slide scenario is untouched', () => {
  assert.deepEqual(musicOf(scenario([card('a'), card('b')])), [null, 'celebrate']);
  assert.deepEqual(musicOf(scenario([card('a')], { music: 'calm' })), ['calm']);
  assert.deepEqual(musicOf(scenario([card('a')])), [null]);
  const one = scenario([card('a')], { music: 'calm', finale: 'none' });
  assert.deepEqual(musicOf(one), ['calm'], 'a one-slide scenario has no finale');
  assert.deepEqual(playCalls(scenario([card('a')], { music: 'calm' }), []), ['calm']);
});

test('a dialogue block whose last line is the final slide gets the default celebrate', () => {
  // (a dialogue slide builds characters, which need a real DOM, so this checks the normalised slides only)
  const sc = scenario([card('a'), block('b', [talk('left', 'Hello.'), talk('right', 'Goodbye.')])], { music: 'calm' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'celebrate']);
});

test('a line with its own music on the last line wins over the finale', () => {
  const sc = scenario([card('a'), block('b', [talk('left', 'Hello.'), talk('right', 'Bye.', { music: 'upbeat' })])], { music: 'calm', finale: 'celebrate' });
  assert.deepEqual(musicOf(sc), ['calm', 'calm', 'upbeat']);
  assert.ok(report(sc).warnings.includes('finale: ignored, the last slide sets its own music'));
});

test('block-level music applies from the first line; the finale still plays on a later last line', () => {
  // judgement call: the block's music is carried by its lines, but only the first line sets it, so the last
  // line has no music of its own and the finale applies
  const sc = scenario([card('a'), block('b', [talk('left', 'Hello.'), talk('right', 'Bye.')], { music: 'tense' })], { music: 'calm' });
  assert.deepEqual(musicOf(sc), ['calm', 'tense', 'celebrate']);
});

// -------------------------------------------------------------- validation

test('celebrate as the top-level music of a 2+ slide scenario is an error', () => {
  const r = report(scenario([card('a'), card('b')], { music: 'celebrate' }));
  assert.deepEqual(r.errors, [
    'music: "celebrate" only plays on the last slide; put it on the last slide, or leave music out so "finale" plays it',
  ]);
});

test('celebrate as the top-level music of a one-slide scenario is allowed', () => {
  assert.deepEqual(report(scenario([card('a')], { music: 'celebrate' })).errors, []);
});

test('celebrate on a slide that is not the last is an error with the slide path', () => {
  const r = report(scenario([card('a'), card('b', { music: 'celebrate' }), card('c')], { music: 'calm' }));
  assert.deepEqual(r.errors, ['slides[1].music: "celebrate" only plays on the last slide; use another mood here']);
});

test('celebrate on a dialogue line that is not the last slide is an error on that line', () => {
  const sc = scenario([card('a'), block('b', [talk('left', 'Hi.'), talk('right', 'Again.', { music: 'celebrate' })]), card('c')], { music: 'calm' });
  assert.deepEqual(report(sc).errors, ['slides[1].dialogue.lines[1].music: "celebrate" only plays on the last slide; use another mood here']);
});

test('celebrate on the last slide, or on a last dialogue line, is allowed', () => {
  assert.deepEqual(report(scenario([card('a'), card('b', { music: 'celebrate' })], { music: 'calm' })).errors, []);
  const sc = scenario([card('a'), block('b', [talk('left', 'Hi.'), talk('right', 'Bye.', { music: 'celebrate' })])]);
  assert.deepEqual(report(sc).errors, []);
});

test('an unknown finale is an error that lists the valid values', () => {
  const r = report(scenario([card('a'), card('b')], { finale: 'party' }));
  assert.deepEqual(r.errors, [
    'finale: unknown finale "party". Valid: celebrate, keep, none, calm, upbeat, tense, playful',
  ]);
});

test('every valid finale value passes validation', () => {
  for (const finale of ['celebrate', 'keep', 'none', 'calm', 'upbeat', 'tense', 'playful']) {
    assert.deepEqual(report(scenario([card('a'), card('b')], { finale })).errors, [], finale);
  }
});

test('a finale set on a one-slide scenario is not an error', () => {
  assert.deepEqual(report(scenario([card('a')], { finale: 'none' })).errors, []);
});

// -------------------------------------------------------------- the CLI and the shipped examples

test('the shipped examples still validate with the same warnings as before the finale', () => {
  const expected = {
    'code-review-chat.js': ['WARN   (scenario): 5 sound effects; 4 or fewer is enough', 'WARN   (scenario): 98 s long; the target is 45-60 s unless the user asked otherwise'],
    'how-claude-works-cinematic.js': [],
    'how-claude-works.js': [],
    'sky-blue.js': [],
    'web-trip.js': [
      'WARN   slides[3]: crowded slide: the speech is shown as a bottom caption; fewer props or a shorter line keeps the normal bubble',
      'WARN   slides[4]: crowded slide: the speech is shown as a bottom caption; fewer props or a shorter line keeps the normal bubble',
    ],
  };
  assert.deepEqual(exampleFiles().slice().sort(), Object.keys(expected).sort());
  for (const name of exampleFiles()) {
    const r = run([VALIDATE, path.join(EXAMPLES, name)]);
    assert.equal(r.status, 0, `${name}: ${r.output}`);
    const lines = r.stdout.split(/\r?\n/).filter((l) => /^(WARN|ERROR)\s/.test(l));
    assert.deepEqual(lines, expected[name], name);
    assert.doesNotMatch(r.stdout, /finale|celebrate/, name);
  }
  for (const name of exampleFiles()) {
    const { scenario: sc, rt } = loadScenarioScript(path.join(EXAMPLES, name));
    assert.deepEqual(plain(rt.Pres.validate(sc)), { errors: [], warnings: [] }, name);
  }
});
