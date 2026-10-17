/*
 * registry.js - where backgrounds, props, the font and the UI helpers register themselves,
 * so the engine and the preview page can discover what exists.
 *
 *   Pres.registerBackground(id, { label, tone, ground, draw(buf), tick(buf, t) })
 *   Pres.registerProp(id, { label, w, h, draw(buf, t), animated })
 *
 * See presentation/CONTRACT.md for the exact rules each asset must follow.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  Pres.GRID = { w: 240, h: 135 };        // the stage: 240 x 135 pixels, shown at 8x for 1920 x 1080
  Pres.backgrounds = {};
  Pres.props = {};

  Pres.registerBackground = (id, def) => {
    if (typeof def.draw !== 'function') throw new Error(`background "${id}" needs draw(buf)`);
    Pres.backgrounds[id] = Object.assign({ label: id, tone: 'light', ground: 118 }, def);
  };

  Pres.registerProp = (id, def) => {
    if (typeof def.draw !== 'function' || !def.w || !def.h) throw new Error(`prop "${id}" needs w, h and draw(buf, t)`);
    Pres.props[id] = Object.assign({ label: id, animated: false }, def);
  };

  // A plain-JSON description of everything available: this is what a scenario author (human or
  // AI) is allowed to reference. The engine adds expressions, poses and skins to it.
  Pres.catalog = () => ({
    grid: Pres.GRID,
    backgrounds: Object.entries(Pres.backgrounds).map(([id, b]) => ({ id, label: b.label, tone: b.tone, ground: b.ground })),
    props: Object.entries(Pres.props).map(([id, p]) => ({ id, label: p.label, w: p.w, h: p.h, animated: !!p.animated })),
  });
})(window);
