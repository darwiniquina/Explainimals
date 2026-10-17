/*
 * font.js - the presentation layer's bitmap font (defines Pres.font).
 *
 * A hand-drawn 5x7 pixel font with rounded letters, covering printable ASCII 32..126.
 * Glyphs are text pictures: one string per row, '#' = ink, '.' = empty. Edit them directly.
 *
 * Normalisation: text is normalised before it is measured, wrapped or drawn, so all three agree.
 * normalize() maps typographic characters to the ASCII the font has: curly quotes to ' and ",
 * dashes (en, em, hyphen, minus) to -, ellipsis to ..., no-break and other Unicode spaces to a space,
 * bullet to *, middle dot to ., multiplication sign to x, arrows to -> and <-. Zero-width characters
 * (U+200B, U+200C, U+200D, U+FEFF, and the emoji selector U+FE0F) are removed. Anything else outside ASCII has no glyph and is drawn as
 * a box. unsupported(text) lists those characters after normalisation, one entry per code point (so an
 * emoji is one entry), for the validator to warn about. Tabs and '\n' are kept as they are.
 *
 * Metrics (all in font pixels, before the integer `scale` is applied):
 *   cap height   7 rows   (row 0 = cap line, row 6 = baseline)
 *   x-height     5 rows   (rows 2..6; lowercase letters start at row 2)
 *   descenders   2 rows   (rows 7..8: g j p q y _ |)
 *   glyphHeight  9        one line box, cap line to the lowest descender
 *   leading      2        extra gap between wrapped lines
 *   lineHeight   11       glyphHeight + leading (the pitch between lines)
 *   spacing      1        blank column between two letters; letters are proportional
 *
 * API (see presentation/CONTRACT.md):
 *   Pres.font.measure(text, {scale})                -> {w, h}
 *   Pres.font.draw(buf, text, x, y, color, {scale, shadow})
 *   Pres.font.wrap(text, maxWidth, {scale})         -> string[]
 *   Pres.font.normalize(text)                       -> string   (the mapping described above)
 *   Pres.font.unsupported(text)                     -> string[] (distinct characters that still draw as a box)
 * Unknown characters are drawn as a small box. Tabs count as spaces. '\n' starts a new line.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});

  const GLYPH_H = 9;
  const LEADING = 2;
  const LINE_H = GLYPH_H + LEADING;
  const SPACING = 1;
  const DEFAULT_COLOR = '#2d2540';

  // Glyph art. Row 0 is the cap line; baseline is row 6. Missing trailing rows are blank.
  const G = {
    ' ': ['...'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '"': ['#.#', '#.#'],
    '#': ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
    '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
    '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
    '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
    "'": ['#', '#'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    ',': ['..', '..', '..', '..', '..', '##', '##', '#.'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    '.': ['..', '..', '..', '..', '..', '##', '##'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    ':': ['..', '..', '##', '##', '..', '##', '##'],
    ';': ['..', '..', '##', '##', '..', '##', '##', '#.'],
    '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
    '>': ['#....', '.#...', '..#..', '...#.', '..#..', '.#...', '#....'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####'],

    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

    '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
    '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
    ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
    '^': ['..#..', '.#.#.', '#...#'],
    '_': ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####'],
    '`': ['#.', '.#'],

    a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
    b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
    c: ['.....', '.....', '.###.', '#...#', '#....', '#...#', '.###.'],
    d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
    e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.####'],
    f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
    g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
    h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
    i: ['#', '.', '#', '#', '#', '#', '#'],
    j: ['.#', '..', '.#', '.#', '.#', '.#', '.#', '#.', '#.'],
    k: ['#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    l: ['#.', '#.', '#.', '#.', '#.', '#.', '##'],
    m: ['.....', '.....', '##.##', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
    n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
    o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
    p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#', '....#'],
    r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
    s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
    t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
    u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
    v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
    x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '...#.', '##...'],
    z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],

    '{': ['.##', '.#.', '.#.', '#..', '.#.', '.#.', '.##'],
    '|': ['#', '#', '#', '#', '#', '#', '#', '#', '#'],
    '}': ['##.', '.#.', '.#.', '..#', '.#.', '.#.', '##.'],
    '~': ['.....', '.....', '.....', '.##.#', '#.##.', '.....', '.....'],
  };

  // drawn for any character that has no glyph
  const BOX = ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'];

  const cache = new Map();
  function glyph(ch) {
    if (ch === '\t') ch = ' ';
    let g = cache.get(ch);
    if (g) return g;
    const rows = Object.prototype.hasOwnProperty.call(G, ch) ? G[ch] : BOX;
    let w = 1;
    rows.forEach((r) => { if (r.length > w) w = r.length; });
    const px = [];
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (r[x] === '#') px.push([x, y]);
    });
    g = { w, px };
    cache.set(ch, g);
    return g;
  }

  const scaleOf = (o) => (o && o.scale >= 1 ? Math.floor(o.scale) : 1);
  const toText = (t) => (t == null ? '' : String(t));

  // Typographic characters and the ASCII each is drawn as (\u escapes keep this file ASCII).
  const SUBST = new Map();
  const substitute = (chars, to) => { for (const c of chars) SUBST.set(c, to); };
  substitute('\u2018\u2019\u201A\u201B\u2032', "'");            // curly single quotes, prime
  substitute('\u201C\u201D\u201E\u201F\u2033', '"');            // curly double quotes, double prime
  substitute('\u2010\u2011\u2012\u2013\u2014\u2212', '-');      // hyphens, en and em dashes, minus sign
  substitute('\u2026', '...');                                  // ellipsis
  substitute('\u2022', '*');                                    // bullet
  substitute('\u00B7', '.');                                    // middle dot
  substitute('\u00D7', 'x');                                    // multiplication sign
  substitute('\u2192', '->');                                   // rightwards arrow
  substitute('\u2190', '<-');                                   // leftwards arrow
  substitute('\u00A0\u202F\u3000', ' ');                        // no-break and ideographic spaces
  for (let c = 0x2002; c <= 0x200A; c++) SUBST.set(String.fromCharCode(c), ' ');   // en space .. hair space
  const ZERO_WIDTH = new Set(['\u200B', '\u200C', '\u200D', '\uFEFF', '\uFE0F']);
  const NEEDS_NORMAL = /[^\x00-\x7E]/;                          // plain ASCII and control characters pass through

  function normalizeText(text) {
    const s = toText(text);
    if (!NEEDS_NORMAL.test(s)) return s;
    let out = '';
    for (const ch of s) {                                       // for..of walks code points: an emoji is one ch
      if (ZERO_WIDTH.has(ch)) continue;
      const to = SUBST.get(ch);
      out += to === undefined ? ch : to;
    }
    return out;
  }

  // a character the font can draw: printable ASCII, plus the tab and newline that layout handles itself
  const hasGlyph = (ch) => ch === '\n' || ch === '\t' || Object.prototype.hasOwnProperty.call(G, ch);

  // width of one line in pixels (already multiplied by the scale)
  function lineWidth(line, s) {
    let w = 0;
    for (const ch of line) w += glyph(ch).w + SPACING;
    return w > 0 ? (w - SPACING) * s : 0;
  }

  function paint(buf, line, x, y, color, s) {
    let cx = x;
    for (const ch of line) {
      const g = glyph(ch);
      for (const p of g.px) {
        if (s === 1) buf.set(cx + p[0], y + p[1], color);
        else buf.rect(cx + p[0] * s, y + p[1] * s, s, s, color);
      }
      cx += (g.w + SPACING) * s;
    }
  }

  Pres.font = {
    glyphHeight: GLYPH_H,
    leading: LEADING,
    lineHeight: LINE_H,

    normalize(text) {
      return normalizeText(text);
    },

    // distinct characters, after normalisation, that have no glyph and so draw as a box
    unsupported(text) {
      const out = [];
      for (const ch of normalizeText(text)) if (!hasGlyph(ch) && !out.includes(ch)) out.push(ch);
      return out;
    },

    measure(text, opts) {
      const s = scaleOf(opts);
      const lines = normalizeText(text).split('\n');
      let w = 0;
      for (const l of lines) w = Math.max(w, lineWidth(l, s));
      return { w, h: ((lines.length - 1) * LINE_H + GLYPH_H) * s };
    },

    draw(buf, text, x, y, color, opts) {
      const s = scaleOf(opts);
      const lines = normalizeText(text).split('\n');
      const c = color || DEFAULT_COLOR;
      const sh = opts && opts.shadow;
      if (sh) lines.forEach((l, i) => paint(buf, l, x + s, y + s + i * LINE_H * s, sh, s));
      lines.forEach((l, i) => paint(buf, l, x, y + i * LINE_H * s, c, s));
      return buf;
    },

    // greedy word wrap. Explicit '\n' always starts a new line; a word wider than maxWidth is
    // broken between letters. Always returns at least one line ('' for empty text).
    wrap(text, maxWidth, opts) {
      const s = scaleOf(opts);
      const out = [];
      for (const para of normalizeText(text).split('\n')) {
        const words = para.split(/\s+/).filter(Boolean);
        if (!words.length) { out.push(''); continue; }
        let line = '';
        for (let word of words) {
          const cand = line ? line + ' ' + word : word;
          if (lineWidth(cand, s) <= maxWidth) { line = cand; continue; }
          if (line) { out.push(line); line = ''; }
          while (word.length > 1 && lineWidth(word, s) > maxWidth) {
            let n = word.length - 1;
            while (n > 1 && lineWidth(word.slice(0, n), s) > maxWidth) n--;
            out.push(word.slice(0, n));
            word = word.slice(n);
          }
          line = word;
        }
        out.push(line);
      }
      return out;
    },
  };
})(window);
