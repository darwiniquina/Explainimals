# Presentation layer contract

A pixel-art presentation is a **scenario** (JSON) played on a **stage** by an **engine**. Everything on the
stage is native pixel art on one shared grid, so characters, backgrounds, props and text all match.

```
Stage grid        240 x 135 pixels (shown at 8x = 1920 x 1080). x right, y down, whole pixels only.
Characters        61 x 76 pixels each. Six skins, one file each in character/skin-<id>.js: penguin, frog, dog,
                  whisker (the cat), rabbit, bear. The feet are about 70 px
                  below the top of the character box, so a character is placed with its top-left at
                  y = ground - 70 and its feet then touch the background's `ground` line.
Drawing toolkit   presentation/pixel.js     Pres.Buf (sparse pixel buffer), Pres.color helpers
Registry          presentation/registry.js  Pres.registerBackground / registerProp / catalog()
Font + UI         presentation/font.js, presentation/ui.js
Backgrounds       presentation/backgrounds.js
Props             presentation/props.js
Emotes            presentation/emotes.js    Pres.registerEmote / Pres.emoteCatalog, see Emotes below
Engine + player   presentation/engine.js, presentation/player.html
Audio             presentation/audio.js     Pres.audio, see AUDIO.md
```

Everything is a classic `<script>` (no ES modules; the pages must work from `file://`) that attaches to
the global `Pres` object inside an IIFE. Colours are plain hex strings.

## Buf API (presentation/pixel.js, read it before drawing anything)

`set(x,y,c)`, `get`, `has`, `erase`, `rect(x,y,w,h,c)`, `frame(x,y,w,h,c)`, `rrect(x,y,w,h,r,c)`,
`ellipse(cx,cy,rx,ry,c)`, `line(x0,y0,x1,y1,c)`, `sprite(rows, map, x, y)`, `blit(otherBuf, dx, dy)`,
`outline(c)` (adds a 1px outline around what is drawn so far), `dither(x,y,w,h,c,phase)`, `bounds()`,
`clone()`, `svg(dx, dy)`. `Pres.color.darken/lighten/mix(hex, ...)`.

## Art style (applies to every asset)

- Art direction is consistent 2D pixel art: every character (the six skins), background, prop and UI piece
  is built from whole pixels with the same rules below, so they all look like one set.
- Cute, soft, friendly "kawaii pixel" look. Pastel and warm palettes; never harsh, never creepy.
- 1px outline in a dark, saturated tone of the object's own colour (not pure black). 2-tone shading,
  light from the top-left, at most one small highlight pixel cluster per shape.
- No anti-aliasing, no rotation, no scaling: whole pixels only. No stray single pixels.
- Integer zoom is the one exception to the no-scaling rule. The camera (SCENARIO.md, Camera) may magnify the stage
  view by a whole number only (2 or 3, never fractional), and its pans move in whole stage pixels. The art is already
  pixel-perfect, so the view is a window onto it, never a resampled image.
- Palette discipline: each asset uses at most about 8 colours.
- Characters' main body colours for reference: penguin charcoal #4a4a4a (orange beak), frog soft green
  #7db35f (peach belly), dog fawn #e2b27c (brown ears), whisker (the cat) grey tabby #9094a5, rabbit white with a soft
  blue outline #8fb0e6, bear brown #a85d2f. Backgrounds must
  keep these characters readable: no big areas of those hues directly behind the character's standing spot
  (left third of the stage).

## Backgrounds (presentation/backgrounds.js)

```js
Pres.registerBackground('meadow', {
  label: 'Sunny meadow',
  tone: 'light',            // 'light' or 'dark' (the UI picks text colours from this)
  ground: 118,              // y of the floor line where characters stand (feet touch it)
  draw(buf) { /* paint the whole 240 x 135 stage once: sky, scenery, floor */ },
  tick(buf, t) { /* OPTIONAL animated overlay: draw into a fresh empty buf for time t seconds
                   (clouds drifting, stars twinkling...). Called at 12 fps. Must be cheap. */ },
});
```

- `draw` must cover every pixel of 0..239 x 0..134 (no transparent holes).
- Keep the area x 0..70, y `ground-76` .. `ground` calm and low-contrast: the character stands there.
- Keep the area x 90..236, y 8..`ground-8` reasonably calm too: props and text panels are drawn over it.
- Scenery detail belongs at the edges, the horizon and the floor.

## Props (presentation/props.js)

```js
Pres.registerProp('laptop', {
  label: 'Laptop',
  w: 32, h: 24,             // exact bounding box; draw into 0..w-1 x 0..h-1 (outline included)
  animated: true,           // optional; if true draw(buf, t) is called at 12 fps
  draw(buf, t) { /* t = seconds; ignore it for static props */ },
});
```

Props are 16..40 px wide/tall icons that sit on the stage next to a character: they explain a concept.

## Emotes (presentation/emotes.js)

Small icons drawn above a character's head (the `emote` field in SCENARIO.md, Character motion). Each emote is
registered like a prop:

```js
Pres.registerEmote('bulb', {
  label: 'Idea',
  w: 8, h: 10,              // bounding box, at most 12 x 12
  draw(buf, t) { /* t = seconds; a 2-frame animation is allowed */ },
});
Pres.emotes                 // id -> definition
Pres.emoteCatalog()         // -> [{ id, label, w, h }]
```

- The ids are `exclamation question heart dots sweat zzz sparkle bulb`.
- Draw with the `Pres.Buf` API, origin 0,0, as props do.
- Style: retro 8/16-bit, 1px dark outline, 2 or 3 tones, at most about 5 colours. Use a white or light outline
  halo where needed, so the emote reads on both light and dark backgrounds.

## Font + UI (presentation/font.js, presentation/ui.js)

```js
Pres.font.glyphHeight                        // pixel height of one line of text (e.g. 7)
Pres.font.measure(text, {scale})             // -> { w, h }
Pres.font.draw(buf, text, x, y, color, {scale, shadow})   // draw text into a Buf (top-left origin)
Pres.font.wrap(text, maxWidth, {scale})      // -> array of lines that fit maxWidth pixels

// every ui helper returns { buf, w, h } (a Buf drawn at origin 0,0 plus its size)
Pres.ui.bubble({ text, maxWidth, tail })     // speech bubble; tail: 'left' | 'right' | 'none'
Pres.ui.panel({ title, bullets, maxWidth, reveal })   // bullet panel; reveal = how many bullets are visible
Pres.ui.titleCard({ title, subtitle, w })    // big title card with a decorative border
Pres.ui.label(text)                          // tiny tag under a prop, e.g. "Server"
```

`Pres.ui.bubble` also takes an optional `reveal` (how many characters to draw) and returns `lines` and `total`, which the typewriter effect uses. See `presentation/AUDIO.md` (Speech) for the details.

## Sound (presentation/audio.js)

Music and sound effects are generated in the browser with the Web Audio API, so they add no files. The
`Pres.audio` API, the scenario `music` and `sfx` fields and the UI are specified in `presentation/AUDIO.md`.
Sound never affects drawing or layout, and a scenario without sound plays silently.
Conversational scenarios use `dialogue` blocks, expanded by `Pres.expandDialogue` in `presentation/engine.js`; the block format and the expressive voices are specified in `presentation/AUDIO.md` (Voices v2 and dialogue).

## Rules for anyone adding to this layer

- Edit only the files you own. Do not edit pixel.js, registry.js or the character skins.
- Everything must work when opened from `file://`: no `fetch`, no ES modules, no CDN fonts.
- Preview your work in `presentation/assets-preview.html` (it loads whatever files exist).
- Browsers cache scripts: after editing, `await fetch(file, {cache:'reload'}); location.reload()`.
