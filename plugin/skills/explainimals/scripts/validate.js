#!/usr/bin/env node
'use strict';
/*
 * validate.js - checks an Explainimals scenario with the engine's own validator, no browser needed.
 *
 *   node validate.js <scenario.json | scenario.js>
 *
 * A .json file is parsed as JSON. A .js file is written like references/examples/*.js: it sets
 * window.Pres.scenarios['id'] = {...}, and its single entry is validated.
 *
 * Output: one line per problem, "ERROR  <path>: <message>" or "WARN   <path>: <message>", then a summary.
 * When there are no errors it also prints style warnings, layout warnings (overlaps, props that do not fit,
 * a speech caption on a crowded slide) and the total duration and the slide count after dialogue expansion.
 *
 * Exit codes: 0 valid (warnings are allowed), 1 at least one error, 2 the file could not be read or parsed.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRuntime } = require('./lib/load-runtime');
const { probeLayout } = require('./lib/layout-probe');

const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const EXIT_BAD_INPUT = 2;

const USAGE = 'usage: node validate.js <scenario.json | scenario.js>';

// Engine messages look like "slides[2].characters[0].skin: unknown skin ...". Split off the path.
function printFinding(level, message) {
  const m = /^([A-Za-z_][\w.[\]-]*): ([\s\S]*)$/.exec(message);
  const where = m ? m[1] : '(scenario)';
  const text = m ? m[2] : message;
  console.log(`${level.padEnd(6)} ${where}: ${text}`);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Duration and slide count come from the engine itself: Player.load() runs the same normalisation
// (dialogue expansion, default slide durations) that playback uses. The stand-in object below has no
// DOM, and seek() is replaced by a no-op so load() never draws anything.
function measure(Pres, scenario) {
  const stand = Object.create(Pres.Player.prototype);
  stand.chars = new Map();
  stand.seek = () => stand;
  stand.load(scenario);
  return { seconds: stand.duration, slides: stand.sc.slides.length };
}

// Style checks from references/direction.md that the engine does not make. They only ever warn.
const SAY_LIMIT = 110;
const SFX_LIMIT = 4;
const CAMERA_SHARE = 0.3;
const MIN_SECONDS = 40;
const MAX_SECONDS = 75;

function zoomOf(camera) {
  if (!camera || typeof camera !== 'object') return 1;
  if (camera.zoom) return camera.zoom;
  return camera.focus && camera.focus !== 'stage' ? 2 : 1;
}

function sfxCount(sfx) {
  if (!sfx) return 0;
  return Array.isArray(sfx) ? sfx.length : 1;
}

// Walks the slides as written (before dialogue expansion) so messages name the line the author wrote.
function styleWarnings(scenario, seconds) {
  const warns = [];
  const slides = Array.isArray(scenario.slides) ? scenario.slides : [];
  let sfx = 0;
  let moved = 0;
  let prevZoomed = false;

  slides.forEach((slide, i) => {
    if (!slide || typeof slide !== 'object') return;
    const at = `slides[${i}]`;
    sfx += sfxCount(slide.sfx);

    const cam = slide.camera;
    const zoom = zoomOf(cam);
    if (cam && cam.move && cam.move !== 'none') moved += 1;

    if (slide.dialogue && Array.isArray(slide.dialogue.lines)) {
      slide.dialogue.lines.forEach((line, j) => {
        if (line && typeof line.say === 'string' && line.say.length > SAY_LIMIT) {
          warns.push([`${at}.dialogue.lines[${j}].say`, `${line.say.length} characters; keep it under ${SAY_LIMIT}`]);
        }
        sfx += sfxCount(line && line.sfx);
      });
      // A dialogue is one scene, so its lines may share a zoom; the block counts once.
      const blockZoomed = zoomOf(slide.camera) > 1 || slide.dialogue.lines.some((l) => zoomOf(l && l.camera) > 1);
      if (blockZoomed && prevZoomed) warns.push([at, 'two zoomed slides in a row; return to the whole stage in between']);
      prevZoomed = blockZoomed;
      return;
    }

    (Array.isArray(slide.characters) ? slide.characters : []).forEach((c, j) => {
      if (c && typeof c.say === 'string' && c.say.length > SAY_LIMIT) {
        warns.push([`${at}.characters[${j}].say`, `${c.say.length} characters; keep it under ${SAY_LIMIT}`]);
      }
    });
    if (zoom > 1 && prevZoomed) warns.push([at, 'two zoomed slides in a row; return to the whole stage in between']);
    prevZoomed = zoom > 1;
  });

  if (sfx > SFX_LIMIT) warns.push(['(scenario)', `${sfx} sound effects; ${SFX_LIMIT} or fewer is enough`]);
  if (slides.length && moved / slides.length > CAMERA_SHARE) {
    warns.push(['(scenario)', `${moved} of ${slides.length} slides move the camera; keep it to about ${Math.round(CAMERA_SHARE * 100)}%`]);
  }
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    warns.push(['(scenario)', `${seconds.toFixed(0)} s long; the target is 45-60 s unless the user asked otherwise`]);
  }
  return warns;
}

// Layout checks: where the engine puts things on each slide (layout-probe.js). They only run on a valid
// scenario, and a slide the probe could not lay out is skipped.
const CHAR_MARGIN = 8;   // sprites have transparent margins: a prop only counts as hidden well inside a character box

const onStage = (r, grid) => r.x >= 0 && r.y >= 0 && r.x + r.w <= grid.w && r.y + r.h <= grid.h;
const shrink = (r, n) => ({ x: r.x + n, y: r.y + n, w: r.w - 2 * n, h: r.h - 2 * n });

// two rects overlap by more than OVERLAP_TOL px on both axes; a 1-3 px touch is not an overlap
const OVERLAP_TOL = 3;
const overlaps = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > OVERLAP_TOL &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > OVERLAP_TOL;

// [where, text] pairs for one probed slide
function slideOverlaps(entry, grid) {
  const warns = [];
  if (entry.error) return warns;
  const at = `slides[${entry.index}]`;
  const warn = (text) => warns.push([at, text]);
  const { bubble, props, characters, droppedProps = [] } = entry;

  if (entry.labelsHidden) warn('labels hidden on this slide: too many props to show their labels; use fewer props or shorter labels');
  if (droppedProps.length) {
    const n = droppedProps.length;
    warn(`${n === 1 ? '1 prop does not' : `${n} props do not`} fit on this slide and ${n === 1 ? 'is' : 'are'} not shown: ${droppedProps.join(', ')}`);
  }
  // the engine always shows the speech (as a caption when the bubble does not fit), so there is no "dropped" case
  if (bubble) {
    if (bubble.caption && entry.zoom === 1) warn('crowded slide: the speech is shown as a bottom caption; fewer props or a shorter line keeps the normal bubble');
    props.forEach((p) => {
      if (overlaps(bubble, p.rect) || (p.labelRect && overlaps(bubble, p.labelRect))) warn(`the speech bubble covers the "${p.id}" prop`);
    });
    // a caption is a subtitle bar drawn over the stage by design, so only a normal bubble is checked against other characters
    if (!bubble.caption) characters.filter((c) => !c.speaker && overlaps(bubble, c.rect)).forEach((c) => warn(`the speech bubble covers the ${c.skin} at ${c.at}`));
    if (entry.panel && overlaps(bubble, entry.panel)) warn('the speech bubble covers the panel');
    if (entry.title && overlaps(bubble, entry.title)) warn('the speech bubble covers the title card');
  }
  props.forEach((p) => {
    const rects = [p.rect, p.labelRect].filter(Boolean);
    if (rects.some((r) => !onStage(r, grid))) warn(`the "${p.id}" prop is off the stage`);
    if (characters.some((c) => overlaps(p.rect, shrink(c.rect, CHAR_MARGIN)))) warn(`the "${p.id}" prop is hidden behind a character`);
  });
  props.forEach((a, i) => props.slice(i + 1).forEach((b) => {
    if (overlaps(a.rect, b.rect)) warn(`the "${a.id}" and "${b.id}" props overlap`);
  }));
  return warns;
}

function overlapWarnings(Pres, scenario) {
  return probeLayout(Pres, scenario).flatMap((entry) => slideOverlaps(entry, Pres.GRID));
}

function main(argv) {
  if (argv.length !== 1) {
    console.error(USAGE);
    return EXIT_BAD_INPUT;
  }
  const arg = argv[0];
  const file = path.resolve(arg);

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    console.error(`ERROR  ${arg}: file not found`);
    return EXIT_BAD_INPUT;
  }
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.json' && ext !== '.js') {
    console.error(`ERROR  ${arg}: expected a .json or .js scenario file`);
    return EXIT_BAD_INPUT;
  }

  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rt = createRuntime();
  let scenario;

  if (ext === '.json') {
    try {
      scenario = JSON.parse(text);
    } catch (e) {
      console.error(`ERROR  ${arg}: invalid JSON: ${e.message}`);
      return EXIT_BAD_INPUT;
    }
  } else {
    try {
      vm.runInContext(text, rt.context, { filename: file });
    } catch (e) {
      console.error(`ERROR  ${arg}: script failed to run: ${e.message}`);
      return EXIT_BAD_INPUT;
    }
    const ids = Object.keys(rt.Pres.scenarios || {});
    if (ids.length !== 1) {
      const list = ids.length ? `: ${ids.join(', ')}` : '';
      console.error(`ERROR  ${arg}: expected exactly one entry in window.Pres.scenarios, found ${ids.length}${list}`);
      return EXIT_BAD_INPUT;
    }
    scenario = rt.Pres.scenarios[ids[0]];
  }

  const report = rt.Pres.validate(scenario);
  report.errors.forEach((msg) => printFinding('ERROR', msg));
  report.warnings.forEach((msg) => printFinding('WARN', msg));

  if (report.errors.length) {
    console.log(`${plural(report.errors.length, 'error')}, ${plural(report.warnings.length, 'warning')}`);
    return EXIT_INVALID;
  }

  const { seconds, slides } = measure(rt.Pres, scenario);
  const extra = styleWarnings(scenario, seconds).concat(overlapWarnings(rt.Pres, scenario));
  extra.forEach(([where, text]) => console.log(`${'WARN'.padEnd(6)} ${where}: ${text}`));
  console.log(`${plural(report.errors.length, 'error')}, ${plural(report.warnings.length + extra.length, 'warning')}`);
  console.log(`duration: ${seconds.toFixed(1)} s`);
  console.log(`slides: ${slides}`);
  return EXIT_VALID;
}

process.exitCode = main(process.argv.slice(2));
