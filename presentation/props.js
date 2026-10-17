/*
 * props.js - the prop icon library: 42 retro pixel icons (16..40 px) in an 8/16-bit console style,
 * like inventory items from an NES / SNES / Game Boy Advance game. Hard edges, no anti-aliasing,
 * a 1 px near-black outline, 3-tone bevels with the light from the top-left, and a small palette of
 * steel, grey, brick red, burnt orange, mustard, green, teal and cream. Animated props step in whole
 * pixels (LEDs, spinning gear, flame flicker, blinking cursor). Drawn into Pres.Buf; see CONTRACT.md.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const Buf = Pres.Buf;

  const OL = '#1a1220';          // the near-black outline used by every prop
  const BEZEL = '#2a3340';       // dark screen bezel
  const SCREEN = '#1f2a36';      // console screen

  // Tone sets: hi = top/left rim and highlight, mid = body colour, lo = bottom/right rim and shade.
  const T = {
    steel:   { hi: '#9fc3e0', mid: '#4f7ca8', lo: '#2d4f75' },
    grey:    { hi: '#e6e8ec', mid: '#9aa1ab', lo: '#5d646f' },
    red:     { hi: '#d2573f', mid: '#b33b2c', lo: '#7a2219' },
    orange:  { hi: '#f5a24a', mid: '#d2651e', lo: '#8f3d12' },
    mustard: { hi: '#ffe27a', mid: '#e6b52a', lo: '#a7801a' },
    green:   { hi: '#8fe07a', mid: '#3fa34d', lo: '#24642f' },
    teal:    { hi: '#7fe3d6', mid: '#23a39a', lo: '#136663' },
    cream:   { hi: '#fff8e6', mid: '#eadcb4', lo: '#b8a57a' },
    white:   { hi: '#ffffff', mid: '#e6ecf2', lo: '#9fb6cc' },
  };

  // ------------------------------------------------------------------ helpers

  // Paint a silhouette (fn draws it into a scratch Buf) with a 1 px outline around it.
  // Returns the silhouette so the caller can shade it.
  function shape(buf, fn) {
    const sil = new Buf();
    fn(sil);
    const o = sil.clone();
    o.outline(OL);
    buf.blit(o);
    return sil;
  }

  // Shade a silhouette: rim on the top/left edges = hi, rim on the bottom/right = lo, body = mid.
  function bevel(buf, sil, t) {
    const b = sil.bounds();
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (!sil.has(x, y)) continue;
        const hi = !sil.has(x, y - 1) || !sil.has(x - 1, y);
        const lo = !sil.has(x, y + 1) || !sil.has(x + 1, y);
        buf.set(x, y, hi ? t.hi : lo ? t.lo : t.mid);
      }
    }
    return sil;
  }

  // Outline + bevel in one call: a solid hardware object.
  const solid = (buf, t, fn) => bevel(buf, shape(buf, fn), t);

  // Fill a silhouette with one flat colour.
  function flat(buf, sil, c) {
    const b = sil.bounds();
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (sil.has(x, y)) buf.set(x, y, c);
    return buf;
  }

  // Fill a polygon (even-odd scanline on pixel centres) into b.
  function poly(b, pts, c) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) b.set(x, y, c);
      }
    }
    return b;
  }

  // Draw a text-art glyph: '#' pixels in colour c, anything else transparent.
  function glyph(buf, rows, c, x, y) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') buf.set(x + i, y + j, c); }));
  }

  // Star outline points (k even = outer tip, k odd = inner corner).
  const starPts = (cx, cy, R, r) => {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? r : R;
      pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
    }
    return pts;
  };

  // ------------------------------------------------------------------ laptop (static)
  // A boxy CRT-style lid with a phosphor screen, over a flat keyboard base.
  Pres.registerProp('laptop', {
    label: 'Laptop', w: 36, h: 28,
    draw(buf) {
      solid(buf, T.grey, (b) => b.rect(3, 1, 30, 19, 'x'));         // lid
      buf.rect(6, 4, 24, 14, BEZEL);                                // screen bezel
      buf.rect(8, 6, 20, 10, T.teal.mid);                           // phosphor screen
      buf.rect(8, 6, 20, 1, T.teal.hi);                             // glow line
      buf.rect(8, 15, 20, 1, T.teal.lo);
      buf.rect(10, 9, 9, 1, T.teal.hi);                             // text on screen
      buf.rect(10, 11, 13, 1, T.teal.hi);
      buf.rect(10, 13, 6, 1, T.teal.hi);
      buf.set(27, 18, T.green.hi);                                  // power LED
      buf.rect(8, 18, 6, 1, T.grey.lo);                             // badge strip
      solid(buf, T.grey, (b) => b.rect(1, 22, 34, 5, 'x'));         // keyboard base
      for (let x = 4; x <= 30; x += 3) buf.rect(x, 23, 2, 1, T.grey.lo);   // keys
      buf.rect(12, 25, 12, 1, T.grey.lo);                           // space bar
    },
  });

  // ------------------------------------------------------------------ server rack (animated LEDs)
  Pres.registerProp('server', {
    label: 'Server rack', w: 28, h: 36, animated: true,
    draw(buf, t) {
      solid(buf, T.steel, (b) => b.rect(1, 1, 26, 34, 'x'));        // cabinet
      buf.rect(8, 2, 12, 1, T.mustard.mid);                         // label plate
      const f = Math.floor(t * 4) % 3;                              // LED chase, 3 frames
      for (let i = 0; i < 3; i++) {
        const y = 4 + i * 10;
        buf.rect(4, y, 20, 8, OL);                                  // rack unit outline
        buf.rect(5, y + 1, 18, 6, T.grey.mid);
        buf.rect(5, y + 1, 18, 1, T.grey.hi);
        buf.rect(5, y + 6, 18, 1, T.grey.lo);
        buf.rect(6, y + 2, 9, 1, T.grey.lo);                        // vent slots
        buf.rect(6, y + 4, 9, 1, T.grey.lo);
        for (let k = 0; k < 3; k++) buf.set(17 + k * 2, y + 3, k === (f + i) % 3 ? T.green.hi : T.green.lo);
      }
    },
  });

  // ------------------------------------------------------------------ cloud (static)
  // A blocky, stepped white cloud with a cool grey underside.
  Pres.registerProp('cloud', {
    label: 'Cloud', w: 36, h: 22,
    draw(buf) {
      solid(buf, T.white, (b) => {
        b.rect(11, 5, 12, 5, 'x');                                  // top bump
        b.rect(7, 7, 6, 3, 'x');                                    // step
        b.rect(4, 9, 10, 6, 'x');                                   // left bump
        b.rect(19, 8, 11, 7, 'x');                                  // right bump
        b.rect(2, 13, 31, 6, 'x');                                  // flat base
        b.rect(12, 9, 9, 5, 'x');                                   // fill the pocket between the bumps
      });
    },
  });

  // ------------------------------------------------------------------ globe (animated spin)
  // Ocean sphere; the continents scroll sideways 1 px per step and wrap around the sphere.
  const LAND = [[5, 7, 3.5, 4], [7, 16, 2.5, 4.5], [13, 22, 3, 2], [18, 7, 3.5, 2.5], [20, 17, 3, 3.5], [25, 23, 3, 2], [26, 9, 2, 3]];
  const PERIOD = 30;
  Pres.registerProp('globe', {
    label: 'Globe', w: 30, h: 30, animated: true,
    draw(buf, t) {
      const step = Math.floor(t * 3) % PERIOD;
      const sil = shape(buf, (b) => b.ellipse(14.5, 14.5, 14, 14, 'x'));
      const isLand = (u, v) => LAND.some(([cx, cy, rx, ry]) => {
        for (const d of [-PERIOD, 0, PERIOD]) {
          const du = u - cx - d;
          if ((du / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1) return true;
        }
        return false;
      });
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
        if (!sil.has(x, y)) continue;
        const u = (((x + step) % PERIOD) + PERIOD) % PERIOD;
        const tone = isLand(u, y) ? T.green : T.steel;
        const d = x + y - 29;                                       // light from the top-left
        buf.set(x, y, d > 9 ? tone.lo : d < -9 ? tone.hi : tone.mid);
      }
      buf.set(7, 7, T.cream.hi).set(8, 6, T.cream.hi).set(6, 8, T.cream.hi);   // gloss
    },
  });

  // ------------------------------------------------------------------ lightbulb (animated rays)
  Pres.registerProp('lightbulb', {
    label: 'Idea bulb', w: 22, h: 31, animated: true,
    draw(buf, t) {
      const R = [10, 11, 10][Math.floor(t * 4) % 3];                // rays pulse out and back in
      const RH = Math.min(R, 10);                                   // side rays stay inside the 22 px box
      const glass = shape(buf, (b) => { b.ellipse(11, 11, 7, 7, 'x'); b.rect(7, 16, 8, 4, 'x'); });
      bevel(buf, glass, T.mustard);
      for (let y = 8; y <= 11; y++) buf.set(11, y, T.orange.mid);   // straight glowing filament
      buf.set(7, 7, T.cream.hi).set(7, 8, T.cream.hi).set(6, 9, T.cream.hi);  // gloss
      flat(buf, shape(buf, (b) => b.rect(7, 21, 8, 3, 'x')), T.grey.mid);   // collar
      flat(buf, shape(buf, (b) => b.rect(8, 26, 6, 4, 'x')), T.steel.lo);   // screw base
      for (const a of [Math.PI, Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75, Math.PI * 2]) {
        const r = (a === Math.PI || a === Math.PI * 2) ? RH : R;
        buf.line(11 + (r - 1) * Math.cos(a), 11 + (r - 1) * Math.sin(a), 11 + r * Math.cos(a), 11 + r * Math.sin(a), T.mustard.mid);
      }
    },
  });

  // ------------------------------------------------------------------ magnifier (static)
  // A steel-rimmed lens with teal glass and a brick-red handle.
  Pres.registerProp('magnifier', {
    label: 'Search', w: 28, h: 28,
    draw(buf) {
      flat(buf, shape(buf, (b) => { for (let k = 0; k < 8; k++) b.rect(17 + k, 17 + k, 3, 3, 'x'); }), T.red.mid);   // handle
      const lens = shape(buf, (b) => b.ellipse(11, 11, 10, 10, 'x'));
      bevel(buf, lens, T.steel);
      const glass = new Buf();
      glass.ellipse(11, 11, 7, 7, 'x');
      const ring = glass.clone();
      ring.outline(OL);
      buf.blit(ring);                                               // dark line between rim and glass
      bevel(buf, glass, T.teal);
      buf.set(8, 7, T.cream.hi).set(7, 8, T.cream.hi).set(8, 8, T.cream.hi);   // glare
    },
  });

  // ------------------------------------------------------------------ lock (static)
  // A brass padlock: steel shackle with a hole, brass body, keyhole.
  Pres.registerProp('lock', {
    label: 'Lock', w: 22, h: 28,
    draw(buf) {
      solid(buf, T.grey, (b) => {
        b.rect(5, 1, 12, 13, 'x');
        b.erase(5, 1); b.erase(16, 1);                              // rounded top corners
        for (let y = 4; y <= 11; y++) for (let x = 8; x <= 13; x++) b.erase(x, y);   // the hole
      });
      solid(buf, T.mustard, (b) => b.rect(1, 12, 20, 15, 'x'));     // brass body
      buf.ellipse(10.5, 17, 2, 2, OL);                              // keyhole
      buf.rect(10, 18, 2, 4, OL);
      [[4, 15], [17, 15], [4, 23], [17, 23]].forEach(([x, y]) => buf.set(x, y, T.mustard.lo));   // rivets
    },
  });

  // ------------------------------------------------------------------ gear (animated spin)
  // An 8-tooth steel gear. Each step turns the teeth by about 7.5 degrees (whole pixels, no rotation).
  Pres.registerProp('gear', {
    label: 'Settings gear', w: 25, h: 25, animated: true,
    draw(buf, t) {
      const off = (Math.floor(t * 3) % 3) * 0.13;
      const TOOTH = Math.PI / 4;
      const sil = new Buf();
      for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
        const dx = x - 12, dy = y - 12, r = Math.hypot(dx, dy);
        if (r <= 8.2) { sil.set(x, y, '#ffffff'); continue; }       // body disc
        if (r > 11.2) continue;
        const a = Math.atan2(dy, dx) - off;
        const m = ((a % TOOTH) + TOOTH) % TOOTH;
        const d = Math.min(m, TOOTH - m);                           // angle from the nearest tooth
        if (r * Math.sin(d) <= 1.5) sil.set(x, y, '#ffffff');       // tooth, about 3 px wide
      }
      const o = sil.clone();
      o.outline(OL);
      buf.blit(o);
      bevel(buf, sil, T.steel);
      for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {  // hub
        const r = Math.hypot(x - 12, y - 12);
        if (r <= 1.6) buf.set(x, y, OL);
        else if (r <= 3.4) buf.set(x, y, T.grey.hi);
        else if (r <= 4.4) buf.set(x, y, OL);
      }
    },
  });

  // ------------------------------------------------------------------ envelope (animated blink)
  // A cream letter with a steel flap and a red seal; a red badge blinks in the corner.
  Pres.registerProp('envelope', {
    label: 'Email', w: 30, h: 22, animated: true,
    draw(buf, t) {
      bevel(buf, shape(buf, (b) => b.rect(1, 4, 28, 16, 'x')), T.cream);
      poly(buf, [[2, 5], [27, 5], [14.5, 14]], T.steel.hi);         // flap
      buf.line(2, 5, 14, 14, OL).line(27, 5, 15, 14, OL);           // flap edges
      buf.line(2, 18, 11, 12, T.cream.lo).line(27, 18, 18, 12, T.cream.lo);   // bottom folds
      buf.rect(12, 11, 5, 5, T.red.mid);                            // seal
      buf.frame(12, 11, 5, 5, OL);
      buf.set(13, 12, T.red.hi);
      if (Math.floor(t * 2) % 2 === 0) {                            // unread badge blinks
        buf.ellipse(25, 3, 3, 3, OL);
        buf.ellipse(25, 3, 2, 2, T.red.mid);
      }
    },
  });

  // ------------------------------------------------------------------ chart (static)
  // A cream panel with four steel bars and an orange trend arrow rising to the right.
  Pres.registerProp('chart', {
    label: 'Bar chart', w: 32, h: 28,
    draw(buf) {
      solid(buf, T.cream, (b) => b.rect(1, 1, 30, 26, 'x'));
      buf.rect(4, 23, 25, 1, OL);                                   // baseline
      [[5, 6], [11, 10], [17, 8], [23, 13]].forEach(([x, h]) => {
        const y = 23 - h;
        buf.rect(x, y, 4, h, T.steel.mid);
        buf.rect(x, y, 3, 1, T.steel.hi);
        buf.rect(x + 3, y, 1, h, T.steel.lo);
      });
      buf.line(5, 19, 22, 9, T.orange.mid).line(5, 20, 22, 10, T.orange.mid);   // trend shaft (2 px)
      poly(buf, [[20, 4], [28, 4], [28, 12]], T.orange.mid);        // arrowhead
    },
  });

  // ------------------------------------------------------------------ check (static)
  // A bold block check mark on a green rounded tile.
  Pres.registerProp('check', {
    label: 'Done check', w: 24, h: 24,
    draw(buf) {
      solid(buf, T.green, (b) => {
        b.rect(1, 1, 22, 22, 'x');
        b.erase(1, 1); b.erase(22, 1); b.erase(1, 22); b.erase(22, 22);   // rounded corners
      });
      solid(buf, T.cream, (b) => {                                  // thick check stroke
        for (let i = 0; i < 4; i++) b.rect(5 + i, 12 + i, 3, 3, 'x');
        for (let i = 0; i < 9; i++) b.rect(8 + i, 14 - i, 3, 3, 'x');
      });
    },
  });

  // ------------------------------------------------------------------ question (animated bob)
  // A bold block question mark on an orange tile; the whole tile bobs 1 px.
  const QMARK = [
    '..#####..',
    '.#######.',
    '###...###',
    '###...###',
    '......###',
    '.....###.',
    '....###..',
    '....###..',
    '.........',
    '....###..',
    '....###..',
  ];
  Pres.registerProp('question', {
    label: 'Question mark', w: 22, h: 28, animated: true,
    draw(buf, t) {
      const dy = Math.floor(t * 2) % 2;
      const y0 = 3 + dy;
      solid(buf, T.orange, (b) => b.rect(1, y0, 20, 22, 'x'));
      glyph(buf, QMARK, T.cream.hi, 6, y0 + 5);
    },
  });

  // ------------------------------------------------------------------ folder (static)
  // A manila file folder: dark back with tab, a sheet of paper, a lit front cover with a label.
  Pres.registerProp('folder', {
    label: 'Folder', w: 30, h: 24,
    draw(buf) {
      const back = shape(buf, (b) => { b.rect(1, 2, 12, 3, 'x'); b.rect(1, 4, 28, 18, 'x'); });
      flat(buf, back, T.mustard.lo);
      solid(buf, T.cream, (b) => b.rect(5, 2, 20, 7, 'x'));         // paper peeking out
      solid(buf, T.mustard, (b) => b.rect(1, 9, 28, 14, 'x'));      // front cover
      solid(buf, T.cream, (b) => b.rect(4, 13, 14, 5, 'x'));        // label
      buf.rect(6, 15, 10, 1, T.red.mid);
    },
  });

  // ------------------------------------------------------------------ wifi (animated arcs)
  // Three arcs and a dot. Each step lights one more arc (dot, arc 1, arc 2, arc 3).
  const ARCS = [[5, 8], [10, 13], [15, 18]];
  Pres.registerProp('wifi', {
    label: 'Wi-Fi', w: 26, h: 23, animated: true,
    draw(buf, t) {
      const lit = Math.floor(t * 3) % 4;                            // 0..3 arcs on
      const cx = 12.5, cy = 21;
      for (let y = 0; y < 23; y++) for (let x = 0; x < 26; x++) {
        const dx = x - cx, dy = y - cy;
        if (dy > -3) continue;                                      // arcs sit above the dot
        if (Math.abs(dx) > -dy * 0.9) continue;                     // about +-42 degree fan
        const r = Math.sqrt(dx * dx + dy * dy);
        ARCS.forEach(([r0, r1], i) => {
          if (r < r0 || r >= r1) return;
          const tone = i < lit ? T.teal : T.grey;
          buf.set(x, y, r < r0 + 1 ? tone.hi : r >= r1 - 1 ? tone.lo : tone.mid);
        });
      }
      for (let y = 18; y < 23; y++) for (let x = 10; x <= 15; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= 6.5) buf.set(x, y, lit > 0 ? T.teal.mid : T.grey.mid);
      }
    },
  });

  // ------------------------------------------------------------------ database (static)
  // A steel cylinder with a teal lit top and two curved ridges.
  Pres.registerProp('database', {
    label: 'Database', w: 24, h: 30,
    draw(buf) {
      const sil = shape(buf, (b) => {
        b.ellipse(11.5, 5.5, 10.5, 4.5, 'x');                       // top disc
        b.rect(1, 5, 22, 19, 'x');                                  // body
        b.ellipse(11.5, 23.5, 10.5, 4.5, 'x');                      // bottom disc
      });
      bevel(buf, sil, T.steel);
      buf.ellipse(11.5, 5.5, 8.5, 2.8, T.teal.hi);                  // lit top surface
      buf.ellipse(11.5, 5.5, 6.5, 1.6, T.teal.mid);
      for (const cy of [11.5, 17.5]) {                              // curved ridges
        for (let x = 1; x <= 22; x++) {
          const dx = (x - 11.5) / 10.5;
          if (Math.abs(dx) > 1) continue;
          buf.set(x, Math.round(cy + 3.2 * Math.sqrt(1 - dx * dx)), T.steel.lo);
        }
      }
    },
  });

  // ------------------------------------------------------------------ rocket (animated flame)
  // A cream-and-grey rocket with red fins and nose; the flame flickers in three lengths.
  Pres.registerProp('rocket', {
    label: 'Rocket', w: 21, h: 34, animated: true,
    draw(buf, t) {
      const L = [3, 5, 4][Math.floor(t * 6) % 3];
      flat(buf, shape(buf, (b) => poly(b, [[7, 16], [1.5, 25], [7, 25]], 'x')), T.red.mid);     // left fin
      flat(buf, shape(buf, (b) => poly(b, [[14, 16], [19.5, 25], [14, 25]], 'x')), T.red.mid);  // right fin
      solid(buf, T.grey, (b) => b.rect(6, 9, 10, 16, 'x'));                     // body
      buf.rect(6, 17, 10, 2, T.red.mid);                                        // stripe
      flat(buf, shape(buf, (b) => poly(b, [[10.5, 1.5], [15.5, 9], [5.5, 9]], 'x')), T.red.mid);  // nose
      buf.ellipse(10.5, 15, 3, 3, OL);                              // porthole
      buf.ellipse(10.5, 15, 2, 2, T.steel.hi);
      poly(buf, [[6.5, 26], [14.5, 26], [10.5, 26 + L]], T.orange.mid);        // flame
      poly(buf, [[8.5, 26], [12.5, 26], [10.5, 26 + L - 2]], T.mustard.hi);    // hot core
    },
  });

  // ------------------------------------------------------------------ star (animated glint)
  // A chunky mustard star; a short cream glint slides from arm to arm.
  Pres.registerProp('star', {
    label: 'Star', w: 23, h: 23, animated: true,
    draw(buf, t) {
      solid(buf, T.mustard, (b) => poly(b, starPts(11.5, 12, 10.5, 4.7), 'x'));
      const glint = [[[10, 4], [9, 5]], [[6, 9], [5, 10]], [[17, 9], [18, 10]]][Math.floor(t * 4) % 3];
      glint.forEach(([x, y]) => buf.set(x, y, T.cream.hi));
    },
  });

  // ------------------------------------------------------------------ arrow (animated shine)
  // A thick steel arrow pointing right; a cream shine runs along the shaft.
  Pres.registerProp('arrow', {
    label: 'Next arrow', w: 32, h: 16, animated: true,
    draw(buf, t) {
      solid(buf, T.steel, (b) => {
        b.rect(1, 5, 16, 6, 'x');                                   // shaft
        poly(b, [[15, 1], [30, 8], [15, 14]], 'x');                 // broad head
      });
      const pos = 2 + (Math.floor(t * 8) % 12);
      for (let k = 0; k < 4; k++) buf.set(pos + k, 5, T.cream.hi);
    },
  });

  // ------------------------------------------------------------------ cartridge (static, new)
  // A grey game cartridge: ribbed grip on top, red label with cream text, gold edge connector.
  Pres.registerProp('cartridge', {
    label: 'Game cartridge', w: 24, h: 26,
    draw(buf) {
      solid(buf, T.grey, (b) => b.rect(2, 1, 20, 24, 'x'));         // body
      buf.rect(3, 2, 18, 4, T.grey.lo);                             // grip
      for (const x of [5, 8, 11, 14, 17]) buf.rect(x, 2, 1, 4, T.grey.mid);
      flat(buf, shape(buf, (b) => b.rect(5, 8, 14, 9, 'x')), T.red.mid);    // label
      buf.rect(7, 10, 10, 1, T.cream.hi);
      buf.rect(7, 12, 6, 1, T.cream.hi);
      buf.rect(7, 14, 8, 1, T.cream.hi);
      buf.rect(6, 19, 12, 6, T.mustard.mid);                        // gold connector
      for (const x of [7, 9, 11, 13, 15]) buf.rect(x, 20, 1, 4, T.mustard.lo);
    },
  });

  // ------------------------------------------------------------------ floppy (static, new)
  // A 3.5-inch floppy: chamfered steel body, grey metal shutter, cream label with red lines.
  Pres.registerProp('floppy', {
    label: 'Floppy disk', w: 26, h: 26,
    draw(buf) {
      solid(buf, T.steel, (b) => {
        b.rect(1, 1, 24, 24, 'x');
        [[24, 1], [23, 1], [22, 1], [24, 2], [23, 2], [24, 3]].forEach(([x, y]) => b.erase(x, y));   // chamfer
      });
      flat(buf, shape(buf, (b) => b.rect(7, 1, 12, 8, 'x')), T.grey.mid);   // metal shutter
      buf.rect(14, 3, 3, 5, T.grey.lo);                             // shutter slot
      flat(buf, shape(buf, (b) => b.rect(4, 12, 18, 10, 'x')), T.cream.hi); // label
      buf.rect(6, 15, 14, 1, T.red.mid);
      buf.rect(6, 17, 10, 1, T.red.mid);
      buf.rect(6, 19, 12, 1, T.red.mid);
    },
  });

  // ------------------------------------------------------------------ chip (static, new)
  // A square CPU package with silver pins on all four sides and a pin-1 marker.
  Pres.registerProp('chip', {
    label: 'CPU chip', w: 28, h: 28,
    draw(buf) {
      const pin = (x, y, w, h) => solid(buf, T.grey, (b) => b.rect(x, y, w, h, 'x'));
      for (const x of [8, 12, 16, 20]) { pin(x, 1, 2, 6); pin(x, 21, 2, 6); }
      for (const y of [8, 12, 16, 20]) { pin(1, y, 6, 2); pin(21, y, 6, 2); }
      solid(buf, T.steel, (b) => b.rect(6, 6, 16, 16, 'x'));        // package
      buf.rect(8, 8, 2, 2, T.mustard.mid);                          // pin-1 marker
      buf.rect(11, 13, 6, 1, T.grey.hi);                            // printed label lines
      buf.rect(11, 15, 8, 1, T.grey.hi);
      buf.rect(11, 17, 5, 1, T.grey.hi);
    },
  });

  // ------------------------------------------------------------------ terminal (animated cursor, new)
  // A console window: steel title bar with two buttons, dark screen, green '>' prompt, blinking cursor.
  Pres.registerProp('terminal', {
    label: 'Terminal', w: 32, h: 26, animated: true,
    draw(buf, t) {
      solid(buf, T.steel, (b) => b.rect(1, 1, 30, 24, 'x'));        // window
      buf.rect(2, 2, 28, 4, T.steel.lo);                            // title bar
      buf.rect(4, 3, 8, 2, T.steel.hi);
      buf.rect(25, 3, 2, 2, T.red.mid);                             // window buttons
      buf.rect(28, 3, 2, 2, T.mustard.mid);
      buf.rect(2, 6, 28, 18, SCREEN);                               // screen
      glyph(buf, ['#..', '.#.', '..#', '.#.', '#..'], T.green.hi, 5, 9);   // prompt '>'
      if (Math.floor(t * 2) % 2 === 0) buf.rect(10, 9, 3, 5, T.green.hi);  // blinking cursor
      buf.rect(5, 16, 12, 1, T.grey.mid);                           // output lines
      buf.rect(5, 19, 18, 1, T.grey.mid);
      buf.rect(5, 21, 8, 1, T.grey.mid);
    },
  });

// ------------------------------------------------------------------ coin (static, new)
  // A gold coin with a raised rim, an inner stamp ring and a dark dollar mark.
  Pres.registerProp('coin', {
    label: 'Coin', w: 24, h: 24,
    draw(buf) {
      const DOLLAR = ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'];
      solid(buf, T.mustard, (b) => b.ellipse(11.5, 11.5, 11, 11, 'x'));   // coin disc
      buf.ellipse(11.5, 11.5, 8, 8, T.mustard.lo);                        // stamp ring
      buf.ellipse(11.5, 11.5, 7, 7, T.mustard.mid);
      glyph(buf, DOLLAR, T.orange.lo, 9, 8);
    },
  });

  // ------------------------------------------------------------------ building (static, new)
  // A cream office block with a steel cornice, a grid of teal windows and a red door.
  Pres.registerProp('building', {
    label: 'Building', w: 30, h: 36,
    draw(buf) {
      solid(buf, T.cream, (b) => b.rect(3, 5, 24, 30, 'x'));              // tower body
      flat(buf, shape(buf, (b) => b.rect(1, 1, 28, 4, 'x')), T.steel.mid); // roof cornice
      for (const y of [8, 14, 20]) for (const x of [7, 13, 19]) {         // window grid
        buf.rect(x, y, 4, 4, T.teal.mid);
        buf.rect(x, y, 4, 1, T.teal.hi);
      }
      flat(buf, shape(buf, (b) => b.rect(12, 27, 6, 8, 'x')), T.red.mid); // door
      buf.set(16, 31, OL);                                                // door handle
    },
  });

  // ------------------------------------------------------------------ document (static, new)
  // A cream sheet with a folded top-right corner, a red heading bar and grey text lines.
  Pres.registerProp('document', {
    label: 'Document', w: 24, h: 30,
    draw(buf) {
      solid(buf, T.cream, (b) => poly(b, [[1, 1], [17, 1], [23, 7], [23, 29], [1, 29]], 'x'));   // sheet
      flat(buf, shape(buf, (b) => poly(b, [[17, 1], [17, 7], [23, 7]], 'x')), T.grey.mid);      // folded corner
      buf.rect(4, 9, 12, 2, T.red.mid);                                   // heading bar
      [[13, 15], [16, 15], [19, 12], [22, 15], [25, 8]].forEach(([y, w]) => buf.rect(4, y, w, 1, T.grey.mid));
    },
  });

  // ------------------------------------------------------------------ bin (static, new)
  // A plain green waste bin: a slightly wider grey lid with a handle, and three vertical ribs down the body.
  Pres.registerProp('bin', {
    label: 'Bin', w: 24, h: 30,
    draw(buf) {
      solid(buf, T.green, (b) => b.rect(3, 9, 18, 20, 'x'));              // body
      for (const x of [7, 11, 15]) buf.rect(x, 12, 1, 15, T.green.lo);   // vertical ribs
      solid(buf, T.grey, (b) => b.rect(1, 5, 22, 4, 'x'));                // lid
      solid(buf, T.grey, (b) => b.rect(9, 1, 6, 3, 'x'));                 // handle
    },
  });

  // ------------------------------------------------------------------ calendar (static, new)
  // A white page with a red header strip, two steel binder rings, a grid of days and one red day.
  Pres.registerProp('calendar', {
    label: 'Calendar', w: 28, h: 28,
    draw(buf) {
      solid(buf, T.white, (b) => b.rect(1, 4, 26, 23, 'x'));              // page
      buf.rect(1, 4, 26, 6, T.red.mid);                                   // header strip
      solid(buf, T.steel, (b) => b.rect(7, 1, 3, 5, 'x'));                // binder ring left
      solid(buf, T.steel, (b) => b.rect(18, 1, 3, 5, 'x'));               // binder ring right
      const COLS = [3, 9, 15, 21], ROWS = [11, 16, 21];
      ROWS.forEach((y, r) => COLS.forEach((x, c) => {
        buf.rect(x, y, 4, 4, r === 1 && c === 2 ? T.red.mid : T.grey.mid);   // day cells, one highlighted
      }));
    },
  });

// ------------------------------------------------------------------ clock (animated second hand, new)
  // A round wall clock: grey case, cream face with hour marks, hands at 10:10, a red second hand ticking once a second.
  Pres.registerProp('clock', {
    label: 'Clock', w: 28, h: 28, animated: true,
    draw(buf, t) {
      const cx = 13.5, cy = 13.5, ex = cx + 0.5, ey = cy + 0.5;    // ex, ey: same centre in poly() space
      solid(buf, T.grey, (b) => b.ellipse(cx, cy, 13, 13, 'x'));   // case
      buf.ellipse(cx, cy, 10.5, 10.5, T.grey.lo);                  // inner bezel ring
      buf.ellipse(cx, cy, 9.5, 9.5, T.cream.mid);                  // face
      for (let k = 0; k < 12; k++) {                               // 12 hour marks, quarters are bigger
        const a = (k * Math.PI) / 6, r = 7.5;
        const x = Math.round(cx + r * Math.sin(a)), y = Math.round(cy - r * Math.cos(a));
        if (k % 3 === 0) buf.rect(x - 1, y - 1, 2, 2, OL);
        else buf.set(x, y, OL);
      }
      const hand = (L, deg, c) => {                                // 2 px tapered hand from the centre
        const a = (deg * Math.PI) / 180, ux = Math.sin(a), uy = -Math.cos(a), nx = -uy, ny = ux;
        poly(buf, [[ex + nx, ey + ny], [ex + L * ux + nx * 0.5, ey + L * uy + ny * 0.5],
          [ex + L * ux - nx * 0.5, ey + L * uy - ny * 0.5], [ex - nx, ey - ny]], c);
      };
      hand(5.5, 305, OL);                                          // hour hand, pointing at 10
      hand(8, 60, OL);                                             // minute hand, pointing at 2
      const sa = ((Math.floor(t) % 60) * Math.PI) / 30;            // second hand steps once a second
      buf.line(cx - 3 * Math.sin(sa), cy + 3 * Math.cos(sa), cx + 9 * Math.sin(sa), cy - 9 * Math.cos(sa), T.red.mid);
      buf.rect(13, 13, 2, 2, T.red.mid);                           // centre pin
    },
  });

  // ------------------------------------------------------------------ book (static, new)
  // A closed green hardcover: dark spine, cream page edges on the right and bottom, mustard label, red bookmark ribbon.
  Pres.registerProp('book', {
    label: 'Book', w: 28, h: 24,
    draw(buf) {
      shape(buf, (b) => b.rect(1, 1, 26, 22, 'x'));                // outline of the whole book
      buf.rect(1, 1, 3, 22, T.green.lo);                           // spine
      buf.rect(4, 1, 1, 22, OL);                                   // spine crease
      buf.rect(5, 1, 19, 19, T.green.mid);                         // cover
      buf.rect(5, 1, 19, 1, T.green.hi);                           // top edge catches the light
      buf.rect(5, 19, 19, 1, T.green.lo);                          // bottom edge in shade
      buf.rect(23, 1, 1, 19, T.green.lo);                          // right edge of the cover
      buf.rect(24, 1, 2, 22, T.cream.mid);                         // page edges, right
      buf.rect(26, 1, 1, 22, T.cream.lo);
      buf.rect(4, 20, 20, 2, T.cream.mid);                         // page edges, bottom
      buf.rect(4, 22, 23, 1, T.cream.lo);
      flat(buf, shape(buf, (b) => b.rect(7, 5, 11, 7, 'x')), T.mustard.mid);   // title label with dark frame
      buf.rect(9, 7, 7, 1, OL);
      buf.rect(9, 9, 4, 1, OL);
      buf.rect(20, 1, 2, 10, T.red.mid);                           // bookmark ribbon
    },
  });

  // ------------------------------------------------------------------ key (static, new)
  // A gold key: round bow with a dark hole, a shaft and two teeth at the business end.
  Pres.registerProp('key', {
    label: 'Key', w: 30, h: 18,
    draw(buf) {
      solid(buf, T.mustard, (b) => {
        b.ellipse(8.5, 8.5, 7.5, 7.5, 'x');                        // round bow
        b.rect(15, 7, 14, 4, 'x');                                 // shaft
        b.rect(22, 11, 2, 4, 'x');                                 // long tooth
        b.rect(26, 11, 2, 3, 'x');                                 // short tooth
      });
      buf.ellipse(8.5, 8.5, 3, 3, OL);                             // hole in the bow
      buf.set(4, 4, T.cream.hi).set(5, 4, T.cream.hi).set(4, 5, T.cream.hi);   // gloss
    },
  });

  // ------------------------------------------------------------------ trophy (static, new)
  // A gold cup with two loop handles, a stem and a two-step base with a silver plate; a red star on the cup.
  Pres.registerProp('trophy', {
    label: 'Trophy', w: 26, h: 30,
    draw(buf) {
      solid(buf, T.mustard, (b) => {
        b.rect(1, 2, 6, 10, 'x');                                  // handles (holes erased below)
        b.rect(19, 2, 6, 10, 'x');
        b.rect(6, 1, 14, 10, 'x');                                 // cup
        b.rect(7, 11, 12, 3, 'x');                                 // taper
        b.rect(9, 14, 8, 2, 'x');                                  // neck
        b.rect(11, 16, 4, 4, 'x');                                 // stem
        b.rect(7, 20, 12, 2, 'x');                                 // collar
        for (let y = 4; y <= 9; y++) { b.erase(3, y); b.erase(4, y); b.erase(21, y); b.erase(22, y); }
        [[1, 2], [1, 11], [24, 2], [24, 11]].forEach(([x, y]) => b.erase(x, y));   // rounded handle corners
      });
      poly(buf, starPts(13, 6, 3.8, 1.6), T.red.mid);              // star on the cup
      flat(buf, shape(buf, (b) => b.rect(5, 22, 16, 4, 'x')), T.grey.mid);        // silver plate
      buf.rect(8, 23, 10, 2, T.cream.hi);                          // engraved label
      flat(buf, shape(buf, (b) => b.rect(4, 26, 18, 3, 'x')), T.red.mid);         // base
    },
  });

  // ------------------------------------------------------------------ phone (static, new)
  // A portrait smartphone: dark rounded bezel, bright teal screen with app tiles and a chat bubble, home bar.
  Pres.registerProp('phone', {
    label: 'Phone', w: 18, h: 32,
    draw(buf) {
      const bez = { hi: '#4a5566', mid: '#2a3340', lo: '#2a3340' };   // dark bezel, lit on the top-left only
      solid(buf, bez, (b) => b.rrect(1, 1, 16, 30, 2, 'x'));
      buf.rect(3, 4, 12, 23, T.teal.hi);                           // bright screen
      buf.rect(7, 2, 4, 1, OL);                                    // speaker slot
      [[4, 8, T.mustard], [10, 8, T.red], [4, 14, T.green]].forEach(([x, y, c]) => buf.rect(x, y, 4, 4, c.mid));   // app tiles
      buf.rect(4, 20, 10, 4, T.cream.mid);                         // chat bubble
      [6, 8, 10].forEach((x) => buf.set(x, 22, OL));
      buf.rect(6, 28, 6, 1, bez.hi);                               // home bar
    },
  });

// ------------------------------------------------------------------ sun (animated ray flicker, new)
  Pres.registerProp('sun', {
    label: 'Sun', w: 30, h: 30, animated: true,
    draw(buf, t) {
      const f = Math.floor(t * 2) % 2;                              // which rays are long this step
      const TOOTH = Math.PI / 4;
      const rays = new Buf(), disc = new Buf();
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
        const dx = x - 14.5, dy = y - 14.5, r = Math.hypot(dx, dy);
        if (r <= 8) { disc.set(x, y, '#ffffff'); rays.set(x, y, '#ffffff'); continue; }
        const a = Math.atan2(dy, dx), n = Math.round(a / TOOTH);     // n = nearest ray
        const d = Math.abs(a - n * TOOTH);                           // angle from that ray's axis
        const long = ((((n % 2) + 2) % 2) + f) % 2 === 0;
        if (r > (long ? 13 : 12)) continue;
        if (Math.cos(d) > 0 && r * Math.sin(d) <= 2.6 - (r - 8) * 0.18) rays.set(x, y, '#ffffff');
      }
      const o = rays.clone();
      o.outline(OL);
      buf.blit(o);
      bevel(buf, rays, T.orange);
      bevel(buf, disc, T.mustard);
      buf.set(9, 11, T.cream.hi).set(10, 10, T.cream.hi).set(11, 9, T.cream.hi);   // gloss
    },
  });

  // ------------------------------------------------------------------ moon (static, new)
  Pres.registerProp('moon', {
    label: 'Moon', w: 24, h: 28,
    draw(buf) {
      solid(buf, T.cream, (b) => {
        for (let y = 0; y < 28; y++) for (let x = 0; x < 24; x++) {
          const inMoon = ((x - 11.5) / 11) ** 2 + ((y - 13.5) / 12.5) ** 2 <= 1;
          const inBite = (x - 16.5) ** 2 + (y - 9.5) ** 2 <= 10.5 ** 2;
          if (inMoon && !inBite) b.set(x, y, '#ffffff');
        }
      });
      buf.rect(4, 15, 3, 3, T.cream.lo);                            // craters
      buf.rect(9, 21, 2, 2, T.cream.lo);
      solid(buf, T.mustard, (b) => poly(b, starPts(18.5, 4.5, 3.8, 1.7), 'x'));   // tiny star in the bite
    },
  });

  // ------------------------------------------------------------------ tree (static, new)
  Pres.registerProp('tree', {
    label: 'Tree', w: 28, h: 36,
    draw(buf) {
      const bark = { hi: '#c98f55', mid: '#8b5a2b', lo: '#5a3818' };       // local brown tones
      solid(buf, bark, (b) => b.rect(10, 20, 8, 14, 'x'));                 // trunk, under the crown
      solid(buf, T.green, (b) => {
        b.ellipse(13.5, 9, 9, 8.5, 'x');                                   // top lobe
        b.ellipse(7, 14.5, 6.5, 6.5, 'x');                                 // left lobe
        b.ellipse(20, 14.5, 6.5, 6.5, 'x');                                // right lobe
        b.rect(7, 12, 14, 9, 'x');                                         // fill between lobes
      });
      buf.rect(9, 5, 3, 1, T.green.hi).rect(5, 12, 2, 2, T.green.hi);    // leaf glints
      buf.rect(15, 13, 4, 2, T.green.lo).rect(9, 17, 3, 2, T.green.lo).rect(21, 10, 2, 3, T.green.lo);   // dark clumps
    },
  });

  // ------------------------------------------------------------------ water drop (static, new)
  Pres.registerProp('drop', {
    label: 'Water drop', w: 18, h: 26,
    draw(buf) {
      solid(buf, T.teal, (b) => {
        b.ellipse(8.5, 16, 8, 8, 'x');                                     // round belly
        poly(b, [[9, 1.5], [16, 14], [2, 14]], 'x');                       // tapering top
      });
      buf.set(5, 11, T.white.hi).set(4, 12, T.white.hi).set(4, 13, T.white.hi);   // glint
    },
  });

  // ------------------------------------------------------------------ flame (animated flicker, new)
  Pres.registerProp('flame', {
    label: 'Flame', w: 22, h: 30, animated: true,
    draw(buf, t) {
      const k = Math.floor(t * 6) % 3;                                // three flicker frames
      const tipX = [10.5, 11.5, 9.5][k], tipY = [1.2, 1.8, 1.5][k];   // main tongue lean and height
      const leftY = [11, 10, 12][k];                                  // left flick tip
      const inPoly = (pts, px, py) => {                               // even-odd test at one point
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const flame = (x, y, s) => {                                    // the flame shrunk by s toward its base
        const u = 10.5 + (x - 10.5) / s, v = 27 + (y - 27) / s;
        return (u - 10.5) ** 2 + (v - 18.5) ** 2 <= 81
          || inPoly([[tipX, tipY], [17.5, 21], [3.5, 21]], u, v)
          || inPoly([[4, leftY], [11, 22], [1.5, 22]], u, v)
          || inPoly([[17.5, 13], [19, 22], [12, 22]], u, v);
      };
      const sil = shape(buf, (b) => {
        for (let y = 0; y < 30; y++) for (let x = 0; x < 22; x++) if (flame(x, y, 1)) b.set(x, y, '#ffffff');
      });
      bevel(buf, sil, T.red);
      const mid = new Buf(), core = new Buf();
      for (let y = 0; y < 30; y++) for (let x = 0; x < 22; x++) {
        if (sil.has(x, y) && flame(x, y, 0.62)) mid.set(x, y, '#ffffff');
        if (mid.has(x, y) && flame(x, y, 0.32)) core.set(x, y, '#ffffff');
      }
      bevel(buf, mid, T.orange);
      flat(buf, core, T.mustard.hi);
    },
  });

// ------------------------------------------------------------------ brain (static, new)
  // A pink side-view brain: a round cerebrum with folds, a cerebellum at the back and a short stem.
  Pres.registerProp('brain', {
    label: 'Brain', w: 30, h: 26,
    draw(buf) {
      const pink = { hi: '#ffb8dc', mid: '#ec6fae', lo: '#a62c6e' };
      const sil = shape(buf, (b) => {
        b.ellipse(14.5, 11, 12.5, 9, 'x');                          // cerebrum
        b.ellipse(21.5, 17.5, 5, 3.5, 'x');                         // cerebellum
        b.rect(9, 17, 4, 8, 'x');                                   // brain stem
      });
      bevel(buf, sil, pink);
      const groove = '#8a2360';                                     // darker fold lines
      const fold = (pts) => pts.forEach((p, i) => { if (i) buf.line(pts[i - 1][0], pts[i - 1][1], p[0], p[1], groove); });
      fold([[6, 11], [9, 9], [12, 11], [15, 9]]);                   // gyri (fold lines)
      fold([[14, 5], [16, 9], [15, 12], [20, 11], [24, 13]]);
      fold([[8, 16], [11, 14], [14, 16]]);
      fold([[17, 16], [21, 15], [25, 16]]);                         // cerebellum ridge
    },
  });

  // ------------------------------------------------------------------ battery (animated charge, new)
  // A grey cell with a terminal nub. Charge fills from the bottom: two green segments are full and the
  // top slot is empty, flickering on as the charge pulse.
  Pres.registerProp('battery', {
    label: 'Battery', w: 20, h: 32, animated: true,
    draw(buf, t) {
      solid(buf, T.grey, (b) => {
        b.rect(7, 1, 6, 3, 'x');                                    // terminal nub
        b.rect(1, 4, 18, 27, 'x');                                  // cell
      });
      flat(buf, shape(buf, (b) => b.rect(4, 7, 12, 22, 'x')), OL);         // inset well (outline colour)
      buf.rect(5, 8, 10, 20, SCREEN);
      const slot = (y, lit) => {
        buf.rect(5, y, 10, 6, lit ? T.green.mid : SCREEN);
        if (lit) { buf.rect(5, y, 10, 1, T.green.hi); buf.rect(5, y + 5, 10, 1, T.green.lo); }
      };
      slot(8, Math.floor(t * 4) % 2 === 1);                         // top slot: charge pulse
      slot(15, true);
      slot(22, true);
    },
  });

  // ------------------------------------------------------------------ arrow down (animated shine, new)
  // The 'arrow' prop turned to point down: a steel shaft and a broad head; a cream shine runs down the shaft.
  Pres.registerProp('arrow-down', {
    label: 'Down arrow', w: 16, h: 32, animated: true,
    draw(buf, t) {
      solid(buf, T.steel, (b) => {
        b.rect(5, 1, 6, 16, 'x');                                   // shaft
        poly(b, [[1, 16], [15, 16], [8, 31]], 'x');                 // broad head
      });
      const pos = 2 + (Math.floor(t * 8) % 10);
      for (let k = 0; k < 4; k++) buf.set(6, pos + k, T.cream.hi);
    },
  });

  // ------------------------------------------------------------------ arrow up (animated shine, new)
  // The same steel arrow pointing up; the shine runs up the shaft.
  Pres.registerProp('arrow-up', {
    label: 'Up arrow', w: 16, h: 32, animated: true,
    draw(buf, t) {
      solid(buf, T.steel, (b) => {
        b.rect(5, 15, 6, 16, 'x');                                  // shaft
        poly(b, [[1, 16], [15, 16], [8, 1]], 'x');                  // broad head
      });
      const pos = 26 - (Math.floor(t * 8) % 8);
      for (let k = 0; k < 4; k++) buf.set(6, pos - k, T.cream.hi);
    },
  });

  // ------------------------------------------------------------------ cycle (animated turn, new)
  // Two big teal arcs, each ending in a large arrowhead, chase each other half a turn apart (a refresh symbol).
  // The pair turns 45 degrees per step, four steps a second, and repeats every 180 degrees.
  Pres.registerProp('cycle', {
    label: 'Cycle arrows', w: 28, h: 28, animated: true,
    draw(buf, t) {
      const R = 8.75, HALF = 2.8, HEAD = 5, BODY = 112, TIP = 40;
      const rot = (Math.floor(t * 4) % 4) * 45;                     // 4 steps a second, 45 degrees each
      const starts = [0, 180].map((a) => a + 45 + rot);
      const pt = (r, deg) => [14 + r * Math.cos((deg * Math.PI) / 180), 14 + r * Math.sin((deg * Math.PI) / 180)];
      const sil = shape(buf, (b) => {
        for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
          const dx = x + 0.5 - 14, dy = y + 0.5 - 14, r = Math.hypot(dx, dy);
          if (r < R - HALF || r > R + HALF) continue;
          const a = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (starts.some((s) => ((((a - s) % 360) + 360) % 360) <= BODY)) b.set(x, y, 'x');
        }
        starts.forEach((s) => {
          const e = s + BODY;
          poly(b, [pt(R - HEAD, e), pt(R + HEAD, e), pt(R, e + TIP)], 'x');   // large arrowhead
        });
      });
      bevel(buf, sil, T.teal);
    },
  });
})(window);
