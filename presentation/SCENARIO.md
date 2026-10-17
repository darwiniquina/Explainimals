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
| `music` | optional background loop for the whole presentation: `calm`, `upbeat`, `tense`, `playful` (default: silent). See Sound below |

## Slide

```json
{
  "id": "dns",                       // optional label
  "duration": 6,                     // seconds, 1-30. Optional: derived from the text length
  "background": "night-sky",         // optional: inherits the previous slide's background
  "transition": "dissolve",          // cut | dissolve | wipe   (default: cut on slide 1, else dissolve)
  "music": "calm",                   // optional: switch the background loop from this slide on ("none" stops it)
  "sfx": "pop",                      // optional: one effect: a name, a list, or {id, at}. See Sound below
  "title": { "text": "How the web works", "subtitle": "a pixel explainer", "w": 164 },   // optional title card
  "characters": [
    { "skin": "penguin", "at": "left", "expression": "happy", "pose": "wave",
      "say": "Hi! Let's follow a page on its trip.",     // speech bubble text (max ~110 characters)
      "look": { "x": 0.5, "y": 0 },                      // optional gaze, -1..1
      "talking": false }                                  // only for slides WITHOUT "say" (say => talks)
  ],
  "props": [ "laptop", { "id": "arrow", "flip": true }, { "id": "cloud", "label": "The internet", "enter": "drop", "delay": 1.0 } ],
  "panel": { "title": "Steps", "bullets": ["Browser asks DNS", "DNS finds the server"] }
}
```

- **characters** (max 2, only ONE may have `say` per slide; put each line of a conversation on its own slide): `at` is `left` (default) | `center` | `right`. `expression` and `pose` are the shared
  vocabulary: expressions `neutral happy joy surprised curious thinking confused sad determined sleepy`;
  poses `idle wave point_right point_left point_up present shrug think cheer hands_on_hips`.
  Characters keep their pose between slides, so a pose glides smoothly into the next one.
- **props**: strings or objects. Without `at` they are laid out automatically in a tidy row in the lower right,
  appearing one after another. Use `at: [x, y]` (top-left, stage pixels) only when you need an exact spot.
  `enter`: `none | pop | drop | slide-left | slide-right | dissolve` (default `drop`). `delay` is seconds after the
  slide starts (default `0.5 + 0.45 * index`). `label` adds a small tag under the prop. `flip: true` mirrors
  the prop left-to-right (use it for an `arrow` that should point left, e.g. a return trip).
- **panel**: a bullet list in the upper part of the free area; bullets appear one by one across the slide.
  Max 4 bullets, each 22 characters or fewer (longer ones wrap and the panel grows).
- **title**: a title card (default width 164, or 190 with no character; set `w` to change). Use it for the
  first and last slide. Keep titles short: a long title wraps to three lines and makes the card tall.

## Dialogue blocks (conversations)

Writing a conversation with one slide per line is slow and repetitive. A dialogue block writes the whole
conversation in one place: a slide that holds a `dialogue` object instead of `characters`. Before validation
and playback the engine expands it into one normal slide per line, so the player and the validator only ever
see ordinary slides.

```jsonc
{
  "background": "classroom",              // optional, applies to every slide of the block
  "music": "playful",                     // optional, like a normal slide (applies from the first slide on)
  "dialogue": {
    "cast": { "left": "penguin", "right": "rabbit" },   // 1 or 2 entries; positions left | center | right; value = skin id
    "lines": [
      { "who": "left",  "say": "Did you review my pull request?", "expression": "curious" },
      { "who": "right", "say": "Yes! It looks great.", "expression": "joy", "pose": "cheer", "react": "happy" },
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
- Pass-through fields on a line: `duration`, `sfx`, `music`, `props`, `transition`, `panel`, `title`. They go
  to that line's slide unchanged.
- **background** and **transition** on the block apply to the first slide. The following slides inherit the
  background and use `cut`, unless the line sets its own `transition`.
- **props** on the block (outside `dialogue`) are shown on the first slide only. A line with its own `props`
  shows those on its slide instead.
- Characters in a dialogue have no gaze (`look` is not set).
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
    { "id": "dns-error", "music": "tense", "sfx": "error", "characters": [ ... ] },
    { "id": "recap", "music": "upbeat", "sfx": "confirm", "characters": [ ... ] }
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

- Pick ONE music mood for the whole scenario, the one that fits the content: `calm` for gentle science, `upbeat`
  for how-to and good news, `tense` for problems and risks, `playful` for light or kid-friendly topics. Set it at
  the top level, and add a per-slide `music` only for a real change of mood.
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
beside the speaker's head, and is pushed BELOW a title card or panel; if it then does not fit it is skipped
(the validator warns). Therefore: a title slide should not also have a long `say`, and a panel slide should
have a short one.

## Authoring guide for an AI

1. 6-9 slides for a 45-60 second explainer. Slide 1: title card + greeting. Last slide: recap + cheer.
2. One idea per slide. Narration (`say`) under 110 characters, friendly and concrete.
3. Match the face to the words: `happy`/`joy` for good news, `thinking`/`curious` for questions, `surprised`
   for twists, `sad` for problems. Match the pose too: `point_right` toward props, `present` to show something,
   `think` while asking a question, `cheer` to finish.
4. Props explain: 2-4 per slide, left to right in the order the story visits them (laptop, then arrow,
   then cloud, then server). Use `arrow` between steps.
5. Change the background only when the mood or place changes (not on every slide).
6. Run `Pres.validate` and fix every error; read the warnings.
7. Optional sound: follow the sound guidance in the Sound section above.

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
