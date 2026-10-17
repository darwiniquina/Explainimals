# Scenario format (v1)

A scenario is one JSON object that describes a whole pixel-art explainer: slides, who is on them, what
they say, and which props and backgrounds appear. An AI can write it from a topic; the engine
(`presentation/engine.js`) plays it and `Pres.validate(scenario)` returns helpful errors if a name is wrong.

```json
{
  "title": "How a website loads",
  "defaults": { "background": "meadow", "skin": "penguin" },
  "slides": [ { ...slide }, { ...slide } ]
}
```

| Field | Meaning |
|---|---|
| `title` | free text, shown nowhere by default (used as the file/video name) |
| `defaults.background` | background used until a slide changes it (default: first registered) |
| `defaults.skin` | character used when a slide does not name one: `penguin`, `frog`, `dog`, `whisker` (the cat), `rabbit`, `bear` (default `penguin`) |
| `defaults.fps` | animation rate, default 12 |
| `music` | optional opening background loop: `calm`, `upbeat`, `tense`, `playful` (default: silent). Slides can switch it, see Sound below |

## Slide

```json
{
  "id": "dns",                       // optional label
  "duration": 6,                     // seconds, 1-30. Optional: derived from the text length
  "background": "night-sky",         // optional: inherits the previous slide's background
  "transition": "dissolve",          // see Transitions (default: cut on slide 1, else dissolve)
  "camera": { "focus": "speaker", "zoom": 2, "move": "push-in" },   // optional, see Camera
  "music": "calm",                   // optional: switch the background loop from this slide on ("none" stops it)
  "sfx": "pop",                      // optional: one effect: a name, a list, or {id, at}. See Sound below
  "title": { "text": "How the web works", "subtitle": "a pixel explainer", "w": 164 },   // optional title card
  "characters": [
    { "skin": "penguin", "at": "left", "expression": "happy", "pose": "wave",
      "say": "Hi! Let's follow a page on its trip.",     // speech bubble text (max ~110 characters)
      "look": { "x": 0.5, "y": 0 },                      // optional gaze, -1..1
      "talking": false,                                   // only for slides WITHOUT "say" (say => talks)
      "enter": "hop", "emote": "sparkle" }                // optional motion, see Character motion
  ],
  "props": [ "laptop", { "id": "arrow", "flip": true }, { "id": "cloud", "label": "The internet", "enter": "drop", "delay": 1.0 } ],
  "panel": { "title": "Steps", "bullets": ["Browser asks DNS", "DNS finds the server"] }
}
```

- **characters** (max 2, only ONE may have `say` per slide; put each line of a conversation on its own slide): `at` is `left` (default) | `center` | `right`. `expression` and `pose` are the shared
  vocabulary: expressions `neutral happy joy surprised curious thinking confused sad determined sleepy`;
  poses `idle wave point_right point_left point_up present shrug think cheer hands_on_hips point_down clap thumbs_up facepalm bow arms_crossed stretch shy`. The last eight are described in Character motion.
  Characters keep their pose between slides, so a pose glides smoothly into the next one.
  The motion fields `enter`, `exit`, `walkTo`, `walkAt`, `gaze`, `action` and `emote` are described in Character motion below.
- **props**: strings or objects. Without `at` they are laid out automatically in a tidy row in the lower right,
  appearing one after another. Use `at: [x, y]` (top-left, stage pixels) only when you need an exact spot.
  `enter`: `none | pop | drop | slide-left | slide-right | dissolve` (default `drop`). `delay` is seconds after the
  slide starts (default `0.5 + 0.45 * index`). `label` adds a small tag under the prop. `flip: true` mirrors
  the prop left-to-right (use it for an `arrow` that should point left, e.g. a return trip).
- **panel**: a bullet list in the upper part of the free area; bullets appear one by one across the slide.
  Max 4 bullets, each 22 characters or fewer (longer ones wrap and the panel grows).
- **title**: a title card (default width 164, or 190 with no character; set `w` to change). Use it for the
  first slide (a closing slide is usually a recap or a cheer instead; see `direction.md`). Keep titles short: a long title wraps to three lines and makes the card tall.
- **transition**: how the slide begins, from the previous one. One of `cut`, `dissolve`, `wipe`, `wipe-down`,
  `iris`, `flash`, `checker`, `fade-black`. See Transitions below.
- **camera**: optional view control (focus, zoom, move, shake, letterbox). Without it the slide shows the whole stage.
  See Camera below.

All text fields (`title`, `say`, panel bullets, prop `label`, and dialogue `say` lines) must be plain ASCII. The
pixel font draws only printable ASCII; the engine normalises common smart quotes and dashes, and `validate.js`
warns about any other character. See `direction.md`, "Text the font can draw".

## Transitions

The `transition` field sets how a slide starts:

| Name | Look |
|---|---|
| `cut` | an instant change (default on slide 1) |
| `dissolve` | the default on every other slide |
| `wipe` | a wipe across the stage |
| `wipe-down` | a wipe that moves downward |
| `iris` | a pixel circle closes, then opens |
| `flash` | white for about two steps |
| `checker` | 8x8 checkerboard blocks reveal the new slide |
| `fade-black` | dithers through black and back |

## Camera

The `camera` object on a slide moves the view over the stage. Every slide starts back at the whole stage
unless it has its own `camera`, so the setting is never inherited.

```json
{ "focus": "speaker", "zoom": 2, "move": "push-in", "shake": true, "letterbox": true }
```

| Key | Values | Meaning |
|---|---|---|
| `focus` | `stage` (default), `speaker`, `listener`, `left`, `center`, `right`, `face`, `prop:<propId>`, `panel`, `[x, y]` | the point the view centres on. `face` is the speaker's head (or the first character's head); `[x, y]` is a stage pixel |
| `zoom` | `1`, `2` or `3` (integers) | enlargement. Default 1, or 2 when `focus` is given without `zoom` |
| `move` | `none` (default), `punch-in`, `push-in`, `pull-out`, `reveal`, `pan`, `drift` | how the view changes during the slide (see below) |
| `from` | a focus value | where a `pan` starts; the view slides from here to `focus` |
| `shake` | `true` or `{ "at": seconds }` | screen shake, about 0.4 s and 3 px, decaying. `true` starts at 0.3 s |
| `letterbox` | `true` | 10 px dark bars at the top and bottom of the stage |

The moves:

- `punch-in`: starts at zoom 1 and snaps to `zoom` at 0.4 s.
- `push-in`: steps from 1 up to `zoom` over the slide.
- `pull-out`: starts at `zoom` and steps back down to 1.
- `reveal`: starts at `zoom` on the focus and snaps out to the whole stage at 55% of the slide.
- `pan`: holds `zoom` and slides, in whole-pixel steps, from `from` to `focus`.
- `drift`: holds `zoom` and creeps a few pixels sideways.

Rules:

- The view is 240/zoom by 135/zoom stage pixels, centred on the focus and kept inside the stage. Zoom changes
  in whole steps, so the art stays pixel-perfect.
- With zoom above 1 the speech bubble is drawn as a bottom caption (no tail), not beside the head.
- Do not combine a title card or a panel with zoom above 1: they do not fit the zoomed view.
- A dialogue block may carry a block-level `camera`, which applies to every line. A line's own `camera` replaces it.

## Character motion

These fields go on each entry of `characters`. All are optional.

| Field | Values | Meaning |
|---|---|---|
| `enter` | `none` (default), `pop`, `drop`, `slide`, `hop`, `walk` | how the character arrives. `slide` comes from the nearest stage edge; `hop` slides in with hops; `walk` slides in with a waddle |
| `exit` | `none` (default), `slide`, `hop` | in the last 0.6 s of the slide the character leaves toward the nearest edge |
| `walkTo` | `left`, `center`, `right` | walks (with a waddle) to that slot, taking about 1.2 s |
| `walkAt` | seconds, default 0.5 | when `walkTo` starts |
| `gaze` | `other`, `props`, `forward` (default) | `other` looks at the other character, `props` looks toward the props, `forward` makes no override |
| `action` | `nod`, `shake`, `hop`, `recoil`, `shiver`, or `{ "id", "at" }` | a short body action, default at 0.4 s |
| `emote` | `exclamation`, `question`, `heart`, `dots`, `sweat`, `zzz`, `sparkle`, `bulb`, or `{ "id", "at", "duration" }` | a small icon drawn above the head, default at 0.6 s for 2 s |

The actions:

- `nod`: the head dips twice. `shake`: the head tilts left and right twice. `hop`: one jump of about 6 px.
- `recoil`: a quick lean back of 5 px, then settles. `shiver`: a 1 px jitter for the duration.

The eight new poses:

- `point_down` points at the floor; `clap` has both hands together in front; `thumbs_up` raises one fist.
- `facepalm` puts one hand to the face; `bow` leans forward with the head tilted; `arms_crossed` folds both fists across the chest.
- `stretch` raises both arms; `shy` holds the hands together low, with the head tilted and the body leaning.

Emotes are drawn by `presentation/emotes.js` (see CONTRACT.md, Emotes).

### Authoring advice for camera and motion

- Use the camera sparingly. Most slides need none, so leave them on the whole stage.
- Use at most one camera move per slide. Zoom (`zoom: 2`) only on a key line, then return to the whole stage on the next slide.
- Shake only for an error or a surprise (`"shake": true` on an `error` slide, or a `surprised` twist), never on a calm slide.
- Never put a title card or a panel on a zoomed slide.
- Use at most one emote per character per slide, and match it to the words: `question` for a question, `bulb` for an idea, `sweat` for a worry, `sparkle` for good news.

## Dialogue blocks (conversations)

Writing a conversation with one slide per line is slow and repetitive. A dialogue block writes the whole
conversation in one place: a slide that holds a `dialogue` object instead of `characters`. Before validation
and playback the engine expands it into one normal slide per line, so the player and the validator only ever
see ordinary slides.

```jsonc
{
  "background": "classroom",              // optional, applies to every slide of the block
  "camera": { "focus": "speaker", "zoom": 2 },   // optional, default camera for every line
  "music": "playful",                     // optional, like a normal slide (applies from the first slide on)
  "dialogue": {
    "cast": { "left": "penguin", "right": "rabbit" },   // 1 or 2 entries; positions left | center | right; value = skin id
    "lines": [
      { "who": "left",  "say": "Did you review my pull request?", "expression": "curious", "emote": "question" },
      { "who": "right", "say": "Yes! It looks great.", "expression": "joy", "pose": "cheer", "react": "happy", "react_emote": "heart" },
      { "who": "left",  "say": "Really? Thank you!", "expression": "happy", "sfx": "confirm", "duration": 3 }
    ]
  }
}
```

- **cast**: one or two entries (never more). The key is a position (`left`, `center` or `right`) and the value
  is a skin id. The cast keys are the names that a line's `who` can use.
- **lines**: a non-empty list. Each line has one speaker: `who` is a cast key and `say` is the text (required,
  not empty). Only the speaker talks.
- **expression** and **pose** belong to the speaker. They default to `happy` and `idle`.
- **react** belongs to the listener, the other character on the slide. It defaults to `curious`. The listener
  always has pose `idle`.
- **Speaker motion**: `emote`, `action`, `gaze`, `enter` and `exit` on a line belong to the speaker. They take the
  values of Character motion above.
- **Listener motion**: `react_emote`, `react_action` and `react_gaze` belong to the listener, with the same values.
- **camera** on a line replaces the block-level `camera` for that line's slide. The block-level `camera` (next to
  `dialogue`, like `background`) is the default for every line.
- Pass-through fields on a line: `duration`, `sfx`, `music`, `props`, `transition`, `panel`, `title`. They go
  to that line's slide unchanged.
- **background** and **transition** on the block apply to the first slide. The following slides inherit the
  background and use `cut`, unless the line sets its own `transition`.
- **props** on the block (outside `dialogue`) are shown on the first slide only. A line with its own `props`
  shows those on its slide instead.
- Characters in a dialogue have no `look`. Use the line fields `gaze` and `react_gaze` instead.
- The speaker's voice is the voice of their character (see Speech), so each character sounds like itself.
- A slide with `dialogue` must not also have `characters`, `character` or `say`.

### Three or four characters

A slide has at most two characters, so a story with more characters is written as blocks in a row, each with
its own cast. Two blocks in a row with different casts make a three or four character story:

```jsonc
{ "dialogue": { "cast": { "left": "penguin", "right": "frog" },  "lines": [ ... ] } },
{ "dialogue": { "cast": { "left": "frog",    "right": "bear" },  "lines": [ ... ] } }
```

### Validation

- Errors: `cast` is not an object with 1 or 2 entries; a position or skin id is not valid; `lines` is empty or
  not an array; a `who` is not a cast key; a `say` is missing or empty; `expression`, `react` or `pose` is not
  a valid name; a slide has both `dialogue` and `characters`, `character` or `say`.
- Warning: a cast of two characters whose lines never use one of them.
- Messages name the line, for example `slides[3].dialogue.lines[1]`, not the expanded slide number.

### Authoring advice for dialogue (human or AI)

- Keep each line under 90 characters.
- One idea per line.
- Alternate speakers, so the conversation goes back and forth.
- Match the expression to the words: a question gets `curious`, good news gets `joy`, a mistake gets `sad` or
  `confused`.
- End every question with `?`. The voice rises at the end of a question.
- Use commas and full stops for pauses, as in any speech.
- Vary poses sparingly. Keep most lines at `idle` and use `cheer`, `point_right` or `present` only at a key moment.
- Use 2 to 4 sound effects per scenario at most.

## Sound (optional)

Sound is optional. It is silent until the user presses Play, and it is generated in the browser with the Web
Audio API (`presentation/audio.js`), so a scenario never needs audio files. Two fields control it:

- `music` (top level, or per slide): a background loop. Names: `calm`, `upbeat`, `tense`, `playful`. On a slide,
  `"none"` stops the loop from that slide on, and a slide without `music` keeps the current loop.
- `sfx` (per slide): one effect. Three forms: a name (`"pop"`); a list (`["whoosh", "pop"]`, played in order
  0.4 s apart, the first at 0.15 s); or `{ "id": "coin", "at": 1.2 }` for an exact time in seconds after the
  slide starts.

Effect names: `blip`, `pop`, `jump`, `coin`, `confirm`, `error`, `whoosh`, `typing`, `talk`, `appear`.

```json
{ "title": "How a website loads", "music": "calm",
  "slides": [
    { "id": "intro", "sfx": "appear", "title": { "text": "How a website loads" }, "characters": [ ... ] },
    { "id": "request", "characters": [ ... ] },
    { "id": "dns-error", "music": "tense", "sfx": "error", "characters": [ ... ] },
    { "id": "dns-fix", "characters": [ ... ] },
    { "id": "recap", "music": "upbeat", "sfx": "confirm", "characters": [ ... ] },
    { "id": "close", "characters": [ ... ] }
  ] }
```

```json
{ "id": "tokens", "sfx": { "id": "pop", "at": 2.6 },
  "props": [ { "id": "star", "label": "Tokens", "enter": "pop", "delay": 2.6 } ] }
```

### Speech

A `say` line is typed out letter by letter in the speech bubble, with a short pause at each comma and full stop.
The speaker's mouth moves only while the text is being typed. Each letter also plays a short blip in the
character's own voice, so the character seems to talk (spaces and punctuation stay silent). Nothing is spoken
until the user presses Play.

Two optional top-level booleans control this. Both default to `true`, and any other value is a validation error.

- `"typewriter": false` shows the whole bubble at once, with no typing.
- `"voice": false` keeps the typing but silences the blips.

Each skin has its own voice:

- `penguin`: a clipped mid square.
- `frog`: a croaky saw.
- `dog`: a low square.
- `whisker` (the cat): a high soft triangle that glides up.
- `rabbit`: a very high square.
- `bear`: a deep soft triangle.

The `expression` of a speaker also changes how the voice sounds. `happy`, `joy` and `surprised` sound higher
and brighter, `sad` and `sleepy` sound lower and slower, and the other expressions are close to neutral. A line
that ends with `?` rises in pitch at the end, so a question sounds like a question.

Authoring advice for speech:

- Keep lines short, aim for under 110 characters. Typing runs at about 22 characters per second and is capped so
  it finishes well before the slide ends, so a long line is typed faster and reads less naturally.
- Punctuation makes the pauses, so write real sentences with commas and full stops, not lists of fragments.
- One speaker per slide, as before.
- Nothing is spoken without pressing Play.

### Sound guidance for authors (human or AI)

- Music follows the story. Set the top-level `music` to the opening mood, then add a per-slide `music` at a story
  beat: a problem goes to `tense`, the fix or good news to `upbeat`, the quiet recap to `calm`, a joke or kid-friendly
  aside to `playful`. Switch only at a beat, never for variety: at most 4 changes, none on consecutive slides, and
  each mood lasts at least 2 slides.
- Use at most one `sfx` per slide, and do not put one on every slide. A few per scenario is enough.
- `appear` for a title card (the first slide).
- `pop` when a prop enters. Use `{ "id", "at" }` with the prop's `delay` to match them exactly.
- `whoosh` on a `wipe` transition.
- `confirm` or `coin` on a good outcome.
- `error` for a problem.
- `talk` only for a chatty slide, never on a quiet one.
- Unknown names are validation errors. An `at` at or past the slide's duration is a warning.

## Layout rules the engine follows (so authors do not have to place things)

The stage is 240 x 135 pixels. Characters stand on the background's floor line in their spot. Everything else
(title card, panel, props) goes in the WIDEST FREE GAP between the characters, so nothing lands on a character:
with one character at `left` that is the right two thirds; with characters at `left` and `right` it is the
middle. Props make one row on the floor, spaced by the wider of the prop and its label. The speech bubble sits
beside the speaker's head, and is pushed BELOW a title card or panel.

When a slide is too full the engine adapts, in this order, and `validate.js` reports each step:
- Props that do not fit in one row are packed closer, then put in two rows.
- If they still do not fit, their labels are hidden (icons only), then the last props are not shown.
- If the bubble would cover a prop, a panel, a title card or another character, the speech is shown as a bottom
  caption (the full stage width, 2-3 lines) and the props rise above it. The speech is never dropped.
- With zoom above 1 the bubble is always a bottom caption (see Camera).

So crowded slides still play, but they look best when you keep to the budget in `direction.md` (section 5a).

## Authoring guide for an AI

1. 6-9 slides for a 45-60 second explainer. Slide 1: title card + greeting. Last slide: recap + cheer.
2. One idea per slide. Narration (`say`) under 110 characters, friendly and concrete.
3. Match the face to the words: `happy`/`joy` for good news, `thinking`/`curious` for questions, `surprised`
   for twists, `sad` for problems. Match the pose too: `point_right` toward props, `present` to show something,
   `think` while asking a question, `cheer` to finish.
4. Props explain: 2-3 per slide, left to right in the order the story visits them (laptop, then arrow,
   then cloud). An `arrow` shows the direction of flow between two props and counts toward the 3.
5. Change the background only when the mood or place changes (not on every slide).
6. Run `Pres.validate` and fix every error; read the warnings.
7. Optional sound: follow the sound guidance in the Sound section above.
8. Optional camera and motion: follow the advice under Camera and Character motion, and use one camera move per slide at most.

## Available names

`Pres.catalog()` returns the live lists (backgrounds with tone and ground line, props with sizes, skins,
expressions, poses, positions, enters, transitions). Paste that JSON into an AI prompt to constrain it.

Skins are exactly these six (`Pres.catalog().skins`); any other `skin` value is a validation error:

| skin | character |
|---|---|
| `penguin` | navy penguin with an orange beak |
| `frog` | green frog |
| `dog` | rust-brown dog with floppy ears |
| `whisker` | orange cat (the cat) |
| `rabbit` | tan rabbit with tall ears |
| `bear` | warm-brown bear |

All six are consistent 2D pixel art on the same 61 x 76 grid and share the expression and pose names above,
so a scenario can mix any two of them on a slide.

Music and sound names are also in `Pres.catalog().music` and `Pres.catalog().sfx` (see Sound above).

The new transitions are in `Pres.catalog().transitions`. Emote names come from `Pres.emoteCatalog()`, and
character actions from `Character.actions`. The camera and character motion values are fixed names, listed in
their sections above.
