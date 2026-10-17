'use strict';
/*
 * layout-probe.js - measures where the engine places each slide's parts, without a browser.
 *
 *   const { probeLayout } = require('./lib/layout-probe');
 *   const entries = probeLayout(Pres, scenario);   // one entry per slide after dialogue expansion
 *
 * The numbers come from the engine's own Player._layoutSlide(), run on a stand-in Player that has no DOM
 * (the same trick validate.js uses for the duration). Only the state that method reads is set: the slide's
 * background (for its floor line and tone) and the theme. Every rect is { x, y, w, h } in stage pixels.
 *
 * Entry: { index, id, zoom, characters: [{skin, at, speaker, rect}], bubble: rect | null, sayLength,
 *          panel: rect | null, title: rect | null, props: [{id, rect, labelRect, x, y}], droppedProps: [id] }
 * `bubble` has `caption: true` when the speech is a bottom caption instead of the bubble beside the speaker;
 * it is null only when the slide has no speech. `droppedProps` lists the auto-placed props that did not fit
 * and are not drawn. `sayLength` is the speaker's line length (0 if none).
 * A slide the engine cannot lay out gives { index, id, error } instead.
 */

// The character box and its feet line. These mirror CHAR in engine.js, which is private to the engine.
const CHAR_W = 61, CHAR_H = 76, CHAR_TOP = 70;
const LABEL_GAP = 3;     // a prop's label is drawn this far below the prop (engine.js _render)

const rect = (x, y, w, h) => ({ x, y, w, h });

function standIn(Pres) {
  const stand = Object.create(Pres.Player.prototype);
  stand.chars = new Map();
  stand.seek = () => stand;      // load() would draw; only the normalised slides are needed
  return stand;
}

// Box x of a named slot. AT is private to engine.js, but _focusPoint returns the centre of a named slot.
function slotX(stand, at) {
  return stand._focusPoint(at, 1, { characters: [] })[0] - CHAR_W / 2;
}

// The state _enterSlide sets before it calls _layoutSlide.
function enterBackground(stand, Pres, slide) {
  stand.bg = Pres.backgrounds[slide.background];
  stand.theme = stand.bg.tone === 'dark' ? 'dark' : 'light';
}

function probeSlide(stand, Pres, slide, index) {
  enterBackground(stand, Pres, slide);
  stand._layoutSlide(slide);
  const L = stand.L, ground = stand.bg.ground;
  const speaker = slide.characters.find((c) => c.say);

  const characters = slide.characters.map((c) => ({
    skin: c.skin, at: c.at, speaker: c === speaker,
    rect: rect(slotX(stand, c.at), ground - CHAR_TOP, CHAR_W, CHAR_H),
  }));
  const bubble = L.bubble ? Object.assign(rect(L.bubble.x, L.bubble.y, L.bubble.r.w, L.bubble.r.h), { caption: !!L.bubble.caption }) : null;
  const panel = L.panel ? rect(L.panel.x, L.panel.y, L.panel.r.w, L.panel.r.h) : null;
  const title = L.title ? rect(L.title.x, L.title.y, L.title.r.w, L.title.r.h) : null;

  const props = L.props.map((it) => {
    const w = it.def.w, h = it.def.h;
    const lab = it.p.label && !L.labelsHidden ? Pres.ui.label(it.p.label, { theme: stand.theme }) : null;
    const labelRect = lab ? rect(Math.round(it.x + w / 2 - lab.w / 2), it.y + h + LABEL_GAP, lab.w, lab.h) : null;
    return { id: it.p.id, rect: rect(it.x, it.y, w, h), labelRect, x: it.x, y: it.y };
  });

  return {
    index, id: slide.id, zoom: slide.camera ? slide.camera.zoom : 1,
    characters, bubble, sayLength: speaker ? speaker.say.length : 0,
    panel, title, props, droppedProps: L.droppedProps, labelsHidden: !!L.labelsHidden,
  };
}

// Entries for every expanded slide. Never throws for a bad slide: that slide gets an `error` entry.
function probeLayout(Pres, scenario) {
  const stand = standIn(Pres);
  try {
    stand.load(scenario);        // validates and normalises (dialogue expansion included); seek() is a no-op
  } catch (e) {
    return [{ index: -1, id: null, error: `scenario could not be normalised: ${e.message}` }];
  }
  return stand.sc.slides.map((slide, i) => {
    try {
      return probeSlide(stand, Pres, slide, i);
    } catch (e) {
      return { index: i, id: slide.id, error: e.message };
    }
  });
}

module.exports = { probeLayout };
