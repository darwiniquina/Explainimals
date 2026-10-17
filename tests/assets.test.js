'use strict';
// The prop and background library. Every asset must be drawn inside its declared box (props) or cover the
// whole 240 x 135 stage (backgrounds), and the general-purpose set added in 0.2.4 must stay in the catalog.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers');

const { Pres } = createRuntime();

const GENERAL_PROPS = [
  'coin', 'building', 'document', 'bin', 'calendar', 'clock', 'book', 'key', 'trophy', 'phone',
  'sun', 'moon', 'tree', 'drop', 'flame', 'brain', 'battery', 'arrow-down', 'arrow-up', 'cycle',
];
const GENERAL_BACKGROUNDS = ['city', 'home', 'office', 'lab'];

test('the general-purpose props and backgrounds are registered', () => {
  const missingProps = GENERAL_PROPS.filter((id) => !Pres.props[id]);
  const missingBgs = GENERAL_BACKGROUNDS.filter((id) => !Pres.backgrounds[id]);
  assert.deepEqual(missingProps, []);
  assert.deepEqual(missingBgs, []);
});

test('every prop is drawn inside its declared w x h, at every animation frame', () => {
  const bad = [];
  for (const [id, p] of Object.entries(Pres.props)) {
    const times = p.animated ? [0, 0.125, 0.25, 0.5, 0.75, 1] : [0];
    for (const t of times) {
      const b = new Pres.Buf();
      p.draw(b, t);
      const bb = b.bounds();
      if (!bb) { bad.push(`${id} t=${t}: draws nothing`); continue; }
      if (bb.x < 0 || bb.y < 0 || bb.x + bb.w > p.w || bb.y + bb.h > p.h) {
        bad.push(`${id} t=${t}: drawn ${bb.w}x${bb.h} at ${bb.x},${bb.y} leaves the ${p.w}x${p.h} box`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('every prop is 16..40 px wide and tall (the contract)', () => {
  const bad = Object.entries(Pres.props)
    .filter(([, p]) => p.w < 16 || p.w > 40 || p.h < 16 || p.h > 40)
    .map(([id, p]) => `${id} ${p.w}x${p.h}`);
  assert.deepEqual(bad, []);
});

test('every background covers all 240 x 135 pixels, in draw and after a tick', () => {
  const bad = [];
  for (const [id, bg] of Object.entries(Pres.backgrounds)) {
    const b = new Pres.Buf();
    bg.draw(b);
    let holes = 0;
    for (let y = 0; y < 135; y++) for (let x = 0; x < 240; x++) if (!b.has(x, y)) holes++;
    if (holes) bad.push(`${id}: ${holes} transparent pixels`);
    if (typeof bg.tick === 'function') { bg.tick(b, 0.5); bg.tick(b, 1.5); }
    if (!(bg.ground >= 100 && bg.ground <= 130)) bad.push(`${id}: ground ${bg.ground} is outside 100..130`);
  }
  assert.deepEqual(bad, []);
});
