'use strict';
// Text in the pixel font. Typographic characters are mapped to ASCII look-alikes before anything is measured,
// wrapped or drawn, and the validator warns (never errors) about characters the font still cannot draw.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  SKILL_SCRIPTS, EXAMPLES, exampleFiles, loadScenarioScript, createRuntime, makeTmp, rmTmp, run,
} = require('./helpers');

const VALIDATE = path.join(SKILL_SCRIPTS, 'validate.js');
const { Pres } = createRuntime();

// Arrays and objects made inside the runtime's vm context have another Array prototype, so strict deep
// equality against a literal fails. A JSON copy brings them into this realm.
const plain = (v) => JSON.parse(JSON.stringify(v));

// A one-slide scenario: a penguin on the left saying `say`. Extra slide fields are merged in.
const oneSlide = (say, extra = {}) => ({
  slides: [Object.assign({ characters: [{ at: 'left', skin: 'penguin', say }] }, extra)],
});

// The warnings that come from the glyph check. Every such message names the pixel font.
const glyphWarnings = (report) => plain(report.warnings.filter((w) => /pixel font/.test(w)));

test('normalize maps curly quotes, dashes, ellipsis, bullets, arrows and no-break spaces to ASCII', () => {
  assert.equal(Pres.font.normalize('\u2018a\u2019 \u201Cb\u201D'), `'a' "b"`);
  assert.equal(Pres.font.normalize('x\u2013y \u2014 z\u2212w \u2010'), 'x-y - z-w -');
  assert.equal(Pres.font.normalize('wait\u2026'), 'wait...');
  assert.equal(Pres.font.normalize('a\u00A0b\u2003c\u3000d\u202Fe'), 'a b c d e');
  assert.equal(Pres.font.normalize('\u2022 \u00B7 \u00D7 \u2192 \u2190'), '* . x -> <-');
});

test('normalize removes zero-width characters and keeps newlines and tabs', () => {
  assert.equal(Pres.font.normalize('a\u200Bb\u200Cc\u200Dd\uFEFFe'), 'abcde');
  assert.equal(Pres.font.normalize('one\n\ttwo'), 'one\n\ttwo');
});

test('an emoji with its selector is one unsupported character', () => {
  assert.deepEqual(Array.from(Pres.font.unsupported('❤️')), ['❤']);
});

test('normalize leaves plain ASCII alone and turns non-text values into text', () => {
  assert.equal(Pres.font.normalize("it's a 'test' -- ok?"), "it's a 'test' -- ok?");
  assert.equal(Pres.font.normalize(null), '');
  assert.equal(Pres.font.normalize(42), '42');
});

test('measure, wrap and draw treat curly text the same as its ASCII form', () => {
  const curly = 'it\u2019s \u201Cfine\u201D \u2014 wait\u2026';
  const ascii = `it's "fine" - wait...`;
  assert.deepEqual(Pres.font.measure(curly), Pres.font.measure(ascii));
  assert.deepEqual(Pres.font.measure(curly, { scale: 2 }), Pres.font.measure(ascii, { scale: 2 }));
  assert.deepEqual(plain(Pres.font.wrap(curly, 40)), plain(Pres.font.wrap(ascii, 40)));

  const a = new Pres.Buf(), b = new Pres.Buf();
  Pres.font.draw(a, curly, 3, 4, '#000000');
  Pres.font.draw(b, ascii, 3, 4, '#000000');
  assert.ok(a.size > 0, 'something was drawn');
  assert.deepEqual([...a.m].sort(), [...b.m].sort());
});

test('a speech bubble holds the normalised text, so its reveal count matches what is drawn', () => {
  const bubble = Pres.ui.bubble({ text: 'it\u2019s \u2014 ok' });
  assert.equal(bubble.lines.join(''), "it's - ok");
  assert.equal(bubble.total, "it's - ok".length);
});

test('unsupported lists each character that still has no glyph once, by code point', () => {
  assert.deepEqual(plain(Pres.font.unsupported('caf\u00E9')), ['\u00E9']);
  assert.deepEqual(plain(Pres.font.unsupported('\u00E9t\u00E9')), ['\u00E9']);
  assert.deepEqual(plain(Pres.font.unsupported('\u{1F600}')), ['\u{1F600}']);
  assert.deepEqual(plain(Pres.font.unsupported('hi \u{1F600}\u{1F600} \u{1F601}')), ['\u{1F600}', '\u{1F601}']);
});

test('unsupported is empty for ASCII, for text that normalises, and for newlines and tabs', () => {
  assert.deepEqual(plain(Pres.font.unsupported("Plain ASCII ~!?\n\tok")), []);
  assert.deepEqual(plain(Pres.font.unsupported('\u2018hi\u2019 \u2014 wait\u2026 \u2022 \u2192')), []);
  assert.deepEqual(plain(Pres.font.unsupported('a\u200Bb')), []);
});

test('a curly apostrophe in a say gives no glyph warning', () => {
  const report = Pres.validate(oneSlide('It\u2019s fine \u2014 really\u2026'));
  assert.deepEqual(plain(report.errors), []);
  assert.deepEqual(glyphWarnings(report), []);
});

test('an accented letter in a say gives exactly one warning that names the character and the path', () => {
  const report = Pres.validate(oneSlide('Caf\u00E9 time'));
  assert.deepEqual(plain(report.errors), []);
  const w = glyphWarnings(report);
  assert.equal(w.length, 1, report.warnings.join('\n'));
  assert.ok(w[0].startsWith('slides[0].characters[0].say: '), w[0]);
  assert.ok(w[0].includes('character "\u00E9" (U+00E9) is not in the pixel font'), w[0]);
  assert.ok(w[0].endsWith('will draw as a box; use plain ASCII'), w[0]);
});

test('an emoji in a say gives one warning that names it as one character', () => {
  const w = glyphWarnings(Pres.validate(oneSlide('Done \u{1F600}')));
  assert.equal(w.length, 1);
  assert.ok(w[0].includes('character "\u{1F600}" (U+1F600) is not in the pixel font'), w[0]);
});

test('a warning names at most three characters and counts the rest', () => {
  const w = glyphWarnings(Pres.validate(oneSlide('\u00E9\u00FC\u00F6\u00F1 ok')));
  assert.equal(w.length, 1);
  assert.ok(w[0].includes('characters "\u00E9" (U+00E9), "\u00FC" (U+00FC), "\u00F6" (U+00F6) and 1 more'), w[0]);
  assert.ok(w[0].endsWith('are not in the pixel font and will draw as boxes; use plain ASCII'), w[0]);
});

test('plain ASCII text gives no glyph warning', () => {
  const report = Pres.validate(oneSlide("Hello, it's me: 1 + 2 = 3!"));
  assert.deepEqual(plain(report.errors), []);
  assert.deepEqual(glyphWarnings(report), []);
});

test('title, subtitle, panel title, bullets and prop labels are checked, one warning per field', () => {
  const report = Pres.validate({ slides: [{
    title: { text: 'Caf\u00E9', subtitle: 'ok \u{1F600}' },
    panel: { title: 'Na\u00EFve', bullets: ['fine', 'r\u00E9sum\u00E9'] },
    props: [{ id: 'laptop', label: 'Caf\u00E9' }],
  }] });
  const paths = glyphWarnings(report).map((w) => w.slice(0, w.indexOf(': ')));
  assert.deepEqual(paths.sort(), [
    'slides[0].panel.bullets[1]',
    'slides[0].panel.title',
    'slides[0].props[0].label',
    'slides[0].title.subtitle',
    'slides[0].title.text',
  ]);
});

test('a dialogue line is checked at its own path', () => {
  const report = Pres.validate({ slides: [{
    dialogue: {
      cast: { left: 'penguin', right: 'frog' },
      lines: [{ who: 'left', say: 'Hi' }, { who: 'right', say: 'Caf\u00E9' }],
    },
  }] });
  const w = glyphWarnings(report);
  assert.equal(w.length, 1, report.warnings.join('\n'));
  assert.ok(w[0].startsWith('slides[0].dialogue.lines[1].'), w[0]);
});

test('without font.js the validator skips the glyph check and still validates', () => {
  const { Pres: P } = createRuntime();
  const font = P.font;
  delete P.font;
  try {
    const report = P.validate(oneSlide('Caf\u00E9'));
    assert.deepEqual(plain(report.errors), []);
    assert.deepEqual(glyphWarnings({ warnings: plain(report.warnings) }), []);
  } finally {
    P.font = font;
  }
});

test('every shipped example is free of glyph warnings', () => {
  for (const name of exampleFiles()) {
    const { scenario, rt } = loadScenarioScript(path.join(EXAMPLES, name));
    assert.deepEqual(glyphWarnings(rt.Pres.validate(scenario)), [], name);
  }
});

test('validate.js prints the glyph warning for an accented letter and still exits 0', () => {
  const tmp = makeTmp('text-accent');
  try {
    const file = path.join(tmp, 'accent.json');
    fs.writeFileSync(file, JSON.stringify(oneSlide('Caf\u00E9 time')), 'utf8');
    const r = run([VALIDATE, file]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.stdout, /^WARN\s+slides\[0\]\.characters\[0\]\.say: character "\u00E9" \(U\+00E9\) is not in the pixel font/m);
  } finally {
    rmTmp(tmp);
  }
});

test('validate.js prints no glyph warning for a curly apostrophe', () => {
  const tmp = makeTmp('text-curly');
  try {
    const file = path.join(tmp, 'curly.json');
    fs.writeFileSync(file, JSON.stringify(oneSlide('It\u2019s fine')), 'utf8');
    const r = run([VALIDATE, file]);
    assert.equal(r.status, 0, r.output);
    assert.doesNotMatch(r.output, /pixel font/);
  } finally {
    rmTmp(tmp);
  }
});
