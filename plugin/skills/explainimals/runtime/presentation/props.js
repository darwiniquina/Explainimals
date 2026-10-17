/*
 * props.js - the prop icon library: 22 retro pixel icons (16..40 px) in an 8/16-bit console style,
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
})(window);
