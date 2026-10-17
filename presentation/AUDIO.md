# Audio contract (music and sound effects)

All sound is **generated in the browser with the Web Audio API**. There are no audio files, no downloads
and no licences to track, so the audio costs a few KB of JavaScript. The sound is deliberately retro:
square, triangle and sawtooth waves plus filtered noise, to match the 2D pixel-art branding.

File: `presentation/audio.js` (classic script, IIFE, attaches `Pres.audio`; load it after `registry.js`
and before `engine.js`). It must work from `file://`.

## Pres.audio API

```js
Pres.audio.supported            // true when the browser has AudioContext; if false every call below is a no-op
Pres.audio.sfxNames             // ['blip','pop','jump','coin','confirm','error','whoosh','typing','talk','appear']
Pres.audio.musicNames           // ['calm','upbeat','tense','playful','celebrate']
Pres.audio.catalog()            // { sfx: [{id,label}], music: [{id,label,bpm}] }
Pres.audio.unlock()             // create/resume the AudioContext; call from a click or key handler (autoplay policy)
Pres.audio.sfx(name)            // play one effect now. Unknown name or muted = silent no-op, never throws
Pres.audio.music(name)          // start a looping track; if `name` is already playing do nothing (so music
                                // carries across slides); if another track plays, fade it out (0.15 s) first.
                                // name null/'none'/'' = same as stopMusic()
Pres.audio.stopMusic()          // fade out (0.12 s) and stop the scheduler
Pres.audio.nowPlaying()         // the current music name or null
Pres.audio.setVolume(v)         // 0..1 (default 0.6); setMuted(bool)
Pres.audio.getVolume() ; Pres.audio.isMuted()
Pres.audio.onChange(fn)         // fn() called when volume, mute or the playing track changes (for UI)
```

- Volume and mute persist in `localStorage` key `pxe.audio` as `{"volume":0.6,"muted":false}`; every
  localStorage access is wrapped in try/catch and the code works when it throws.
- Music uses a look-ahead scheduler (`setInterval` 40 ms, schedule notes ~0.2 s ahead), one 16-step
  pattern of eighth notes per mood: lead melody + bass. Music is quieter than effects.
- A muted state still allows `music()` calls to be remembered, so unmuting resumes the right track.
- Nothing ever runs before `unlock()`; `sfx()`/`music()` before unlock are silent no-ops (music remembers
  the requested name and starts at `unlock()` if the call came first).

## Scenario fields

```jsonc
{
  "title": "...",
  "music": "calm",                 // optional: background loop for the whole presentation
  "slides": [
    { "music": "upbeat" },         // optional: switch the loop from this slide on
    { "music": "none" },           // optional: stop the loop from this slide on
    { "sfx": "pop" },              // optional: one effect, played 0.15 s after the slide starts
    { "sfx": ["whoosh", "pop"] },  // several: played in order at 0.15 s, 0.55 s, ... (0.4 s apart)
    { "sfx": [{ "id": "coin", "at": 1.2 }] }   // exact: `at` seconds after the slide starts
  ]
}
```

- A slide without `music` keeps whatever loop is already playing (inherits).
- `celebrate`: a short major fanfare loop, about 140-150 bpm, for the last slide only. Elsewhere, or at the top level
  of a scenario with 2 or more slides, it is an **error**.
- `finale` (top level): the sound on the last slide. Omitted or `"celebrate"` = the fanfare (the default, for 2 or more
  slides when the last slide has no `music`); a mood name = that mood; `"keep"` = the loop continues; `"none"` =
  silence. Any other value is an **error**; `finale` with a `music` on the last slide is a **warning** (the slide wins).
- `sfx` entries may mix strings and `{id, at}` objects.
- Validation (in `Pres.validate`): unknown music/sfx name is an **error** listing the valid names;
  `at` must be a number >= 0 (error otherwise); `at` >= the slide's duration is a **warning**;
  more than 6 sfx on one slide is a **warning**.
- `Pres.catalog()` gains `sfx: [{id,label}]` and `music: [{id,label,bpm}]` (from `Pres.audio.catalog()`),
  or empty arrays when audio.js is not loaded. If audio.js is not loaded, validation of these fields is
  skipped and the fields are ignored (the scenario still plays silently).

## Player behaviour (presentation/engine.js)

- Audio plays only while the player is **playing**. `seek()/next()/prev()` while paused make no sound.
- `Player.play()` calls `Pres.audio.unlock()` (it runs inside the user's click) and starts the music of
  the current slide; `pause()` and the `end` event call `Pres.audio.stopMusic()`.
- Entering a slide while playing: set the music (`Pres.audio.music(effectiveName)`) and reset the slide's
  sfx cues. Cues fire from `_advance` when the slide-local time reaches `at` (fixed steps, so the same
  scenario always fires the same cues at the same frames). Each cue fires once per entry into the slide.
- `new Pres.Player(el, { audio: false })` disables all audio calls (for video export or tests).
- `normalize()` resolves the effective music per slide (`slide.music`: name or null) and a sorted cue list
  per slide (`slide.cues`: `[{ id, at }]`).

## UI

- Presentations view: a Sound button (toggles mute, label shows On/Off), a volume range, a small
  "now playing: <track>" text, key `M` toggles mute. Audio is silent until the first Play click.
- Assets view: a **Sounds** section with a button per effect (plays it), a Play/Stop button per music
  track with its bpm, and a copy-name button like the other sections.
  It also has a **Character voices** group: one Play button per voice that babbles "Hello there, friend!".
- Scenes view: a Music select (none + tracks) for the whole scene and an optional sound-effect select per
  row. Unknown fields (`music`, `sfx`) in a loaded JSON must survive the builder round trip.

# Speech: typewriter text and voice babble

A speech bubble no longer appears all at once. The text is **typed out** letter by letter, and each
character has a **voice** that plays a short blip as the letters appear, so it looks and sounds like it
is talking. The mouth moves only while text is being typed.

## Pres.ui.bubble (presentation/ui.js)

`Pres.ui.bubble({ text, maxWidth, tail, theme, reveal })` gains an optional `reveal`:
- The bubble's size, tail and line breaks are always computed from the FULL text, so the box never
  resizes or jumps while typing.
- `reveal` = how many characters to draw, counted over `lines.join('')` (the wrapped lines concatenated,
  without the spaces dropped at wrap points). Omitted/undefined or >= total = draw everything. Characters
  past the count are simply not drawn (the box stays full size).
- The result gains `lines` (array of strings, exactly what was drawn) and `total` (= `lines.join('').length`).
  Existing fields (`buf, w, h, tip`) are unchanged.

## Pres.audio voices (presentation/audio.js)

```js
Pres.audio.voiceNames        // ['penguin','frog','dog','whisker','rabbit','bear']
Pres.audio.voice(skinId, ch) // one speech blip for character `ch` in that skin's voice; unknown skin = penguin;
                             // silent no-op when muted / not unlocked / unsupported, never throws
Pres.audio.catalog()         // gains voices: [{id, label}]  (label = 'Penguin', 'Frog', 'Dog', 'Cat', 'Rabbit', 'Bear')
```

Blip pitch = voice base frequency * 2^(semitones/12), semitones = (charCode % 8) * spread / 7 (0..spread),
so the same text always sounds the same. Blip length 0.04 to 0.07 s, volume about 0.16, through the master
gain. Voices (type, base Hz, spread semitones, length s): penguin square 300/7/0.05; frog sawtooth 150/5/0.06
with the pitch gliding down to 0.8x; dog square 200/6/0.05; whisker (the cat) triangle 520/8/0.05 gliding up
to 1.15x; rabbit square 620/8/0.04; bear triangle 110/4/0.07.

## Engine behaviour (presentation/engine.js)

- Timeline per speaking slide: the bubble appears at slide-local time `T0 = 0.3` s. Characters are typed
  with weights: a normal character 1, `,` `;` `:` 4, `.` `!` `?` 7 (the weight of a character is the time
  it takes before the next one appears, so punctuation makes a pause). Typing duration
  `typeDur = clamp(total / 22, 0.5, window - 0.6)` seconds with `window = duration - 0.5 - T0`; the visible
  count at local time `lt` is the number of characters whose cumulative start weight is <= progress * total weight, where
  progress = clamp((lt - T0) / typeDur, 0, 1). After typing ends the full text stays until the slide ends.
- The bubble is drawn with `Pres.ui.bubble({..., reveal})`; each reveal state is built once and cached
  (like the panel).
- Mouth: the speaking character is "talking" from T0 until typing ends (+0.15 s), instead of the old
  `0.15 < lt < duration - 0.5` window. Characters with `talking: true` and no `say` are unchanged.
- Voice: only while the player is playing and audio is on. In each fixed step, if new characters
  were revealed and at least one of them is a letter or digit, call `Pres.audio.voice(skin, thatChar)` once
  (the last revealed letter or digit). So there is at most one blip per step; punctuation pauses stay silent.
- Scenario options (top level, both optional booleans, default true): `"typewriter": false` shows the
  whole bubble at once with no typing and the old mouth window; `"voice": false` keeps the typing but plays
  no speech blips. With `"typewriter": false` there is no typing, so there are also no speech blips. Validation: a non-boolean value is an error. `Player` option `{ audio: false }` also
  silences the voice. Seeking while paused never makes a sound.

# Voices v2 and dialogue (conversational scenarios)

Goal: each of the six characters has a distinct, expressive voice, and a scenario can be written as a
conversation between characters with a short `dialogue` block instead of hand-building one slide per line.

## Voice v2 (presentation/audio.js)

`Pres.audio.voice(skinId, ch, opts)` gets an optional third argument (omitting it behaves like before):

```js
opts = { expression: 'happy',   // any engine expression: neutral happy joy surprised curious thinking confused sad determined sleepy
         progress: 0.4,         // 0..1, how far through the line this blip is
         question: true }       // the line ends with '?'
```
- Expression changes the delivery: pitch multiplier / blip length multiplier: neutral 1/1, happy 1.06/1,
  joy 1.12/0.9, surprised 1.15/0.85, curious 1.04/1, thinking 0.97/1.1, confused 1.0/1 (with +-1.5 semitone
  wobble from the char code), sad 0.88/1.2, determined 0.95/0.95, sleepy 0.85/1.35. Unknown expression = neutral.
- `question: true` raises the pitch over the last 30 percent of the line (progress 0.7 to 1) by up to
  +3 semitones. Without `question`, the last 20 percent of the line falls by up to 1.5 semitones (a statement
  ends lower).
- Each voice gets more character: an optional second layer oscillator (a quiet octave-up or slightly
  detuned copy at 25 to 35 percent volume), a small vibrato (4 to 6 Hz, depth under a quarter semitone, only
  on voices that suit it, e.g. bear and cat), and a tuned attack/decay so the six voices are clearly
  different from each other when babbling the same sentence. The six `base/spread/length/type` values of
  the earlier contract stay the starting point; adjust them if needed so all six are distinguishable,
  but keep penguin square ~300 Hz, frog sawtooth ~150 Hz with the downward glide, dog square ~200 Hz,
  whisker (Cat) triangle ~520 Hz with the upward glide, rabbit square ~620 Hz, bear triangle ~110 Hz.
- Also add `Pres.audio.voiceDemo(skinId, text, opts)`: plays a babble of `text` in that voice (one blip per
  letter or digit, 70 ms apart, same pitch rules including punctuation pauses of 3 and 5 blips for `,` and
  `.!?`), returns a cancel function; used by the Assets view. Muted/unsupported = returns a no-op function.

## Dialogue blocks (presentation/engine.js)

A slide may be a dialogue block. It expands, before validation and playback, into one slide per line:

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
- Each line becomes a normal slide with the cast as `characters`: the speaker (`who` = a position key of
  the cast) gets `say`, `expression` (default 'happy') and `pose` (default 'idle');
  the listener gets expression `react` (default 'curious') and pose 'idle'; `look` of every character is
  null. Other slide fields allowed on a line: `duration`, `sfx`, `music`, `props`, `transition`, `panel`, `title`
  (passed straight through). A `props` list on the block (outside `dialogue`) is shown on the FIRST slide only
  unless a line has its own `props`. The block's `background`/`transition` apply to the first slide; the
  following slides inherit the background (normal slide inheritance) and use transition 'cut' unless the
  line sets one.
- Cast switches between blocks are allowed (two blocks in a row with different casts make a three or four
  character story). Max 2 cast entries (the existing 2 characters per slide limit).
- `Pres.expandDialogue(scenario)` (exported) returns a NEW scenario object with all dialogue blocks expanded
  (the input is not mutated; expanded slides carry a non-enumerable-or-plain `_from` string such as
  `slides[3].dialogue.lines[1]`, used in validation messages instead of `slides[N]`). `Pres.validate` and
  `Player.load/normalize` call it first, so old scenarios (no dialogue) are byte-for-byte unaffected.
- Validation (errors): `dialogue.cast` must be an object with 1 or 2 entries with valid positions and valid
  skin ids; `dialogue.lines` a non-empty array; each line needs `who` that is a cast key and `say` a non-empty
  string; `expression`/`react` must be valid expressions; `pose` a valid pose. A slide with both `dialogue`
  and `characters`/`character`/`say` is an error. Warning: a cast with 2 characters whose lines never use
  one of them.
- The engine passes the voice opts: `{ expression: speaker.expression, progress: shown/total, question:
  /\?\s*$/.test(speakerLineText) }` on every blip.

## Example

`presentation/scenarios/` gets `code-review-chat.js` (see that file): a three-part conversation using all six
characters, written with dialogue blocks.
