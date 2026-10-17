'use strict';
// Layout regression. The engine places every slide's props and speech; these checks run on the probe
// output (scripts/lib/layout-probe.js) for the crowded fixture and for every shipped example, so a change
// to the fit rules shows up here before it reaches a user's slide.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  FIXTURES, EXAMPLES, SKILL_SCRIPTS, exampleFiles, readText, loadScenarioScript, createRuntime,
} = require('./helpers');

const { probeLayout } = require(path.join(SKILL_SCRIPTS, 'lib', 'layout-probe'));

// Same numbers as validate.js: the stage size, the margin a sprite's transparent edge gets, and the
// tolerance under which two rects only touch (a 1-3 px overlap is not reported as one).
const STAGE = { w: 240, h: 135 };
const CHAR_MARGIN = 8;
const OVERLAP_TOL = 3;

const overlaps = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > OVERLAP_TOL &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > OVERLAP_TOL;
const onStage = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= STAGE.w && r.y + r.h <= STAGE.h;
const shrink = (r, n) => ({ x: r.x + n, y: r.y + n, w: r.w - 2 * n, h: r.h - 2 * n });

// Each case: a scenario plus the runtime it was loaded into. Dialogue blocks are expanded by the engine,
// so the declared prop count is read from the expanded slides, the same list the probe lays out.
function caseFor(name) {
  if (name === 'crowd.json') {
    const rt = createRuntime();
    const scenario = JSON.parse(readText(path.join(FIXTURES, 'crowd.json')).replace(/^﻿/, ''));
    return { name, scenario, Pres: rt.Pres };
  }
  const { scenario, rt } = loadScenarioScript(path.join(EXAMPLES, name));
  return { name, scenario, Pres: rt.Pres };
}

// Probed once per case: each test below reads the same layout, and probing re-validates the scenario.
function probed(c) {
  if (!c.probed) {
    const entries = probeLayout(c.Pres, c.scenario);
    const declared = c.Pres.expandDialogue(c.scenario).slides.map((s) => (s.props ? s.props.length : 0));
    c.probed = { entries, declared };
  }
  return c.probed;
}

const CASES = ['crowd.json', ...exampleFiles()].map(caseFor);

test('the stage is 240 x 135 pixels, as the layout checks assume', () => {
  assert.deepEqual({ w: CASES[0].Pres.GRID.w, h: CASES[0].Pres.GRID.h }, STAGE);
});

for (const c of CASES) {
  test(`${c.name}: every slide lays out without an error`, () => {
    const { entries, declared } = probed(c);
    assert.equal(entries.length, declared.length, 'one probe entry per expanded slide');
    entries.forEach((e) => assert.equal(e.error, undefined, `slide ${e.index}: ${e.error}`));
  });

  test(`${c.name}: a slide with speech always has a bubble`, () => {
    const { entries } = probed(c);
    entries.forEach((e) => {
      if (e.sayLength > 0) assert.ok(e.bubble, `slide ${e.index} (${e.id}) has speech but no bubble`);
    });
  });

  test(`${c.name}: props and labels stay on the stage`, () => {
    const { entries } = probed(c);
    entries.forEach((e) => e.props.forEach((p) => {
      [p.rect, p.labelRect].filter(Boolean).forEach((r) => {
        assert.ok(onStage(r), `slide ${e.index}: "${p.id}" leaves the ${STAGE.w}x${STAGE.h} stage`);
      });
    }));
  });

  test(`${c.name}: no two props overlap`, () => {
    const { entries } = probed(c);
    entries.forEach((e) => e.props.forEach((a, i) => e.props.slice(i + 1).forEach((b) => {
      assert.ok(!overlaps(a.rect, b.rect), `slide ${e.index}: "${a.id}" and "${b.id}" overlap`);
    })));
  });

  test(`${c.name}: no prop is hidden behind a character`, () => {
    const { entries } = probed(c);
    entries.forEach((e) => e.props.forEach((p) => {
      e.characters.forEach((ch) => {
        assert.ok(!overlaps(p.rect, shrink(ch.rect, CHAR_MARGIN)),
          `slide ${e.index}: "${p.id}" is behind the ${ch.skin} at ${ch.at}`);
      });
    }));
  });

  test(`${c.name}: shown props plus dropped props equal the props declared`, () => {
    const { entries, declared } = probed(c);
    entries.forEach((e) => {
      assert.equal(e.props.length + e.droppedProps.length, declared[e.index],
        `slide ${e.index}: ${e.props.length} shown + ${e.droppedProps.length} dropped != ${declared[e.index]} declared`);
    });
  });
}

// Crowded fixture: the exact outcomes the engine is expected to produce (see tests/fixtures/crowd.json).
test('crowd.json slides 0 and 2 keep every prop; slide 1 keeps speech as a caption and drops its props', () => {
  const crowd = CASES[0];
  const { entries, declared } = probed(crowd);
  assert.equal(entries.length, 3);

  assert.equal(entries[0].droppedProps.length, 0);
  assert.equal(entries[0].props.length, declared[0]);
  assert.equal(entries[2].droppedProps.length, 0);
  assert.equal(entries[2].props.length, declared[2]);

  assert.ok(entries[1].bubble, 'slide 1 speech must still be shown');
  assert.equal(entries[1].bubble.caption, true, 'slide 1 speech should become a bottom caption');
  assert.equal(entries[1].droppedProps.length, 3, 'the panel leaves no room: all three props are dropped');
});

test('crowd.json slide 0 hides its labels rather than dropping props', () => {
  const { entries } = probed(CASES[0]);
  assert.equal(entries[0].labelsHidden, true);
  assert.equal(entries[0].props.length, 4);
});
