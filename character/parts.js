/*
 * parts.js - the shared vocabulary for the explainer characters.
 *
 * Everything the AI is allowed to pick from lives in this file:
 *   CharacterParts.EXPRESSIONS  -> named faces (which eye, brow and mouth variant each one uses)
 *   CharacterParts.POSES        -> named body poses (a fallback for any pose a skin does not define)
 *   CharacterParts.EYE_NAMES / BROW_NAMES / MOUTH_NAMES -> the variant names every skin provides
 *   CharacterParts.TALK_SHAPES  -> mouth shapes cycled while talking
 *
 * The drawing itself lives in each skin (character/skin-*.js). Coordinates, colours and sprites are per skin.
 * "L" / "R" always mean the VIEWER's left / right. For arms, angles are mirrored so the same numbers work on both
 * sides:  s = shoulder angle (0 = hanging down, 90 = straight out to the side, 180 = straight up), e = elbow bend
 * added on top of s (positive = forearm swings upward/outward).
 */
(function (global) {
  'use strict';

  // Variant names. A skin must have an entry in its eyes / brows / mouths tables for each name used here.
  const EYE_NAMES = ['open', 'wide', 'squint', 'closed', 'happy'];
  const BROW_NAMES = ['neutral', 'raised', 'worried', 'angry', 'skeptic'];
  const MOUTH_NAMES = ['closed', 'smile', 'grin', 'open', 'wide', 'small', 'O', 'frown', 'flat', 'smirk', 'wavy'];

  // Mouth shapes cycled (pseudo-randomly, but deterministically) while talking.
  const TALK_SHAPES = ['open', 'small', 'wide', 'O', 'small', 'open', 'closed', 'wide'];

  // --------------------------------------------------------- expressions
  // look: optional default pupil direction (-1..1). cheeks: blush on/off.
  const EXPRESSIONS = {
    neutral: { eyes: 'open', brows: 'neutral', mouth: 'closed' },
    happy: { eyes: 'open', brows: 'raised', mouth: 'smile', cheeks: true },
    joy: { eyes: 'happy', brows: 'raised', mouth: 'grin', cheeks: true },
    surprised: { eyes: 'wide', brows: 'raised', mouth: 'O' },
    curious: { eyes: 'open', brows: 'skeptic', mouth: 'smirk', look: { x: 0.6, y: -0.3 } },
    thinking: { eyes: 'open', brows: 'skeptic', mouth: 'flat', look: { x: 0.8, y: -0.8 } },
    confused: { eyes: 'open', brows: 'worried', mouth: 'wavy' },
    sad: { eyes: 'open', brows: 'worried', mouth: 'frown', look: { x: 0, y: 0.6 } },
    determined: { eyes: 'squint', brows: 'angry', mouth: 'flat' },
    sleepy: { eyes: 'closed', brows: 'neutral', mouth: 'small' },
  };

  // --------------------------------------------------------------- poses
  // L / R: { s: shoulder, e: elbow, h: hand }.  h = 'open' | 'point' | 'fist'
  // tilt: head tilt in degrees. lean: body shift in px. lift: body raise in px.
  // wave: { arm, amp, freq } oscillates that elbow. bounce: hop amplitude in px.
  const IDLE_ARM = { s: 6, e: 4, h: 'open' };
  const POSES = {
    idle: { L: IDLE_ARM, R: IDLE_ARM },
    wave: {
      L: IDLE_ARM,
      R: { s: 150, e: 25, h: 'open' },
      wave: { arm: 'R', amp: 24, freq: 2.4 },
      tilt: 3,
    },
    point_right: { L: IDLE_ARM, R: { s: 78, e: 4, h: 'point' }, tilt: 3, lean: -4 },
    point_left: { L: { s: 78, e: 4, h: 'point' }, R: IDLE_ARM, tilt: -3, lean: 4 },
    point_up: { L: IDLE_ARM, R: { s: 168, e: 0, h: 'point' }, tilt: 3 },
    present: { L: { s: 55, e: 50, h: 'open' }, R: { s: 55, e: 50, h: 'open' } },
    shrug: { L: { s: 30, e: 105, h: 'open' }, R: { s: 30, e: 105, h: 'open' }, tilt: 7, lift: 4 },
    // elbow out, fist at the chin
    think: { L: IDLE_ARM, R: { s: 135, e: 147, h: 'fist' }, tilt: -6, lean: -3 },
    cheer: {
      L: { s: 138, e: 28, h: 'fist' },
      R: { s: 138, e: 28, h: 'fist' },
      bounce: 10,
    },
    hands_on_hips: { L: { s: 40, e: -75, h: 'fist' }, R: { s: 40, e: -75, h: 'fist' }, lean: 0 },
  };

  global.CharacterParts = {
    EYE_NAMES,
    BROW_NAMES,
    MOUTH_NAMES,
    TALK_SHAPES,
    EXPRESSIONS,
    POSES,
  };
})(window);
