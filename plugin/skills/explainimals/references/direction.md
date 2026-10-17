# Creative direction

Tuning rules for writing a pixel explainer. The JSON format is in `scenario.md`; every valid name is in
`catalog.md`. Each rule gives its reason, so you can bend it when the reason does not apply.

## 1. Story shapes

Pick one shape from the topic. Target 6-9 slides for 45-60 s. Slides with `say` get no `duration` (the engine
derives it from the text); slides without `say` (title, props only) get `duration` 3-5.

### A. Explain a concept (7 slides, about 50 s)

Use for "what is X" and "why does X happen".

| # | Slide | Setup | Moments |
|---|---|---|---|
| 1 | Title and greeting | `title`, one penguin on `wave`, `sfx: appear`, a greeting under 40 characters | the greeting is shown as a bottom caption (a title card leaves no room for a bubble) |
| 2 | The question | dog asks, `curious`, `question` emote | `think` pose, the question ends with `?` |
| 3 | Everyday comparison | penguin answers, 2-3 props, `point_right` | props explain the comparison |
| 4 | The key idea | penguin `happy`, `bulb` emote, camera punch-in zoom 2 | one zoomed key line, the view snaps in |
| 5 | Common misunderstanding | rabbit corrects, two-line dialogue | `surprised` only if the mistake is a surprise |
| 6 | Recap | penguin `present`, panel with 3 bullets | the whole stage (no camera on a panel) |
| 7 | Close | penguin `cheer`, `sparkle` emote | `sfx: confirm`, the one good-news effect |

### B. How it works, step by step (8 slides, about 55 s)

Use for processes: a request, a build, a data trip.

| # | Slide | Setup | Moments |
|---|---|---|---|
| 1 | Title | `title`, penguin `wave`, `sfx: appear` | none |
| 2 | Starting point | one character, one prop (the input) | `point_right` at the prop |
| 3-5 | Step 1, 2, 3 | one speaker per step, props in order with `arrow` between | one step can use `pan` along the props (see camera) |
| 6 | Outcome | joy pose, `coin` or `confirm` | the result is the good news |
| 7 | Recap | panel of the 3 steps | the whole stage |
| 8 | Close | `cheer`, `heart` or `sparkle` emote | none |

Reason: a process is easier to follow when each step has its own slide and its own prop, and the props sit in
the order the story visits them.

### C. Problem, fix, recap (7 slides, about 50 s)

Use for debugging, risks, and "how to avoid X".

| # | Slide | Setup | Moments |
|---|---|---|---|
| 1 | Title and hook | `title`, `sfx: appear` | none |
| 2 | Problem | dog `sad` or `surprised`, `error` sfx, `tense` music | camera punch-in with `shake: true` (an error is the one allowed shake) |
| 3 | Cause | whisker `thinking`, `dots` emote | none |
| 4 | Fix | penguin `determined`, `point_right` at a prop, `confirm` sfx | none |
| 5 | Check | rabbit and penguin dialogue (2-4 lines) | camera on the speaker, zoom 2 |
| 6 | Recap | panel of 3 habits, `upbeat` music | the whole stage |
| 7 | Close | `cheer` or `thumbs_up`, `sparkle` | none |

Reason: the problem slide is the only place where the view moves hard; a calm fix is easier to trust.

## 2. Cast

Each skin has a default role that matches its voice (see `scenario.md`, Speech). Keep the role steady across
a scenario, so the viewer learns who is who.

| Skin | Default role | Voice | Typical expressions | Typical poses |
|---|---|---|---|---|
| `penguin` | the host: narrates, presents, closes | clipped mid square | `happy`, `joy`, `determined` | `present`, `point_right`, `cheer`, `idle` |
| `bear` | the expert: explains the detail | deep soft triangle | `determined`, `thinking`, `happy` | `present`, `point_up`, `arms_crossed` |
| `rabbit` | the quick questioner: asks what happens next | very high square | `curious`, `surprised`, `joy` | `wave`, `point_up`, `cheer` |
| `dog` | the everyday user with the problem | low square | `curious`, `confused`, `sad`, `joy` | `shrug`, `point_up`, `cheer` |
| `whisker` (cat) | the careful checker: verifies, reviews | soft triangle that glides up | `thinking`, `determined`, `sleepy` | `think`, `arms_crossed`, `shrug` |
| `frog` | the comic reactor: jokes, gets startled | croaky saw | `surprised`, `sad`, `joy` | `facepalm`, `hands_on_hips`, `idle` |

Reason: a question from the rabbit or the dog sounds like a question; the penguin's clipped voice suits a host.
The skin's voice is part of its role, so put the questions on the skin whose voice fits them.

### One character, a pair, or chained blocks

- **One character** (`characters` with one entry): the title, the greeting, a recap, and any slide with a
  long prop explanation. Reason: one speaker reads faster than two.
- **A pair in one dialogue block** (`dialogue` with two-cast): questions and answers, a correction, a check.
  Use 3-6 lines. Reason: back-and-forth is the clearest way to show a misunderstanding.
- **Chained dialogue blocks** (a new `dialogue` with a different cast): a story with 3 or 4 characters. Each block
  has 2-4 lines. Reason: a slide holds at most two characters, so a third character starts a new block.
- A listener with no `say` is silent; give it `react` and `react_emote` in a dialogue (its face and emote
  react to the speaker), not a second `say`.

### Three or four characters

The three never stand on screen together: a slide shows at most two. Write a rotating chain of 2-3-line blocks,
so each character shares a scene with each of the others and the viewer still feels one cast:

```jsonc
{ "dialogue": { "cast": { "left": "frog", "right": "bear" }, "lines": [ ... 2-3 lines ... ] } },
{ "dialogue": { "cast": { "left": "bear", "right": "whisker" }, "lines": [ ... ] } },
{ "dialogue": { "cast": { "left": "whisker", "right": "frog" }, "lines": [ ... ] } }
```

Plan the chain so that the line that ends one block is the hook the next block answers. Remember that every line
is one slide: three blocks of 3 lines are 9 slides, about 50 s, so keep each block short. Put a `title` slide
first and a one-character recap last. Use `walkTo` or `enter` for a character that arrives or changes sides.

### Props for ideas the catalog lacks

The catalog is small (no moon, bed, clock, battery, food). Reuse the nearest prop and give it a `label` that
names the idea: `{ "id": "star", "label": "Moon" }`, `{ "id": "lightbulb", "label": "Energy" }`,
`{ "id": "gear", "label": "Body clock" }`. Reason: the label carries the meaning when the art cannot.

## 3. Camera vocabulary

Write the camera only when the intent below applies. Every slide starts on the whole stage.

| Intent | `camera` | Why |
|---|---|---|
| Reveal a punchline | `{ "focus": "speaker", "zoom": 2, "move": "punch-in" }` | the view snaps in on the line, so the joke lands at once |
| Build tension while explaining | `{ "focus": "speaker", "zoom": 2, "move": "push-in" }` | the view creeps in and the viewer leans forward |
| Recap or big picture | `{ "focus": "speaker", "zoom": 2, "move": "pull-out" }` | starts close, steps back to the whole stage: the story widens |
| Follow a journey A to B | `{ "focus": "right", "from": "left", "zoom": 2, "move": "pan" }` (or `"focus": "prop:<id>"`) | the eye travels with the story |
| Emotional close-up | `{ "focus": "face", "zoom": 2 }` (zoom 3 only for an opening) | a face says more than a line |
| Error or shock | `{ "focus": "speaker", "zoom": 2, "move": "punch-in", "shake": true }` | the shake and the snap show the surprise |
| Cinematic opening | `{ "focus": "face", "zoom": 3, "move": "reveal", "letterbox": true }` | a slow reveal sets the mood; use once |

### Pacing budget

- At most about 30% of slides have a camera move (2 or 3 of 9 slides, for example).
- Never two zoomed slides in a row, unless they are lines of one dialogue block (a dialogue is one scene).
- After a zoom, return to the whole stage on the next slide: a camera-less slide. Reason: the viewer needs the
  wide view to see the props and the layout again.

### Interaction rules

- With zoom above 1 the speech bubble becomes a bottom caption. Write a zoomed line as one short sentence.
- Never put a title card or a panel on a zoomed slide: they do not fit the zoomed view.
- `focus` without `zoom` means zoom 2. Write `zoom` explicitly so the intent is visible.
- Use `shake` only for an error or a real surprise, never on a calm slide.

## 4. Motion and emotes

- **`enter`** on a character's first appearance only: `hop` or `walk` for a friendly arrival, `pop` or `drop`
  for a quiet one, `slide` for an entrance from the edge. Reason: repeated entrances make a slide busy.
- **`exit`** (`hop` or `slide`) only on a character's last slide, or on the last line of its dialogue.
- **`walkTo`** (`left`, `center`, `right`) with `walkAt` for a move: the walk takes about 1.2 s, so the slide
  must last at least `walkAt` + 2 s, or the line will be typed under a moving character.
- **`gaze`**: `other` in a dialogue, so speakers look at each other; `props` when the character points at a
  prop; leave it out otherwise. Reason: a character that looks at nothing reads as absent.
- **`action`**: `nod` for agreement, `shake` for disagreement, `hop` for good news, `recoil` for a shock,
  `shiver` for worry. Use one action per character per slide.
- **`emote`**: one per character per slide, matched to the words: `question` for a question, `bulb` for an idea,
  `sweat` for a worry, `sparkle` for good news, `heart` for thanks, `exclamation` for a surprise, `dots` for a
  pause while thinking, `zzz` for sleep. Time it with `{ "id", "at", "duration" }` when a prop or line needs it.
- Poses glide between slides. Do not change pose on every slide; keep most at `idle` and use `cheer`,
  `point_right` or `present` at key moments. Reason: a pose only means something when it is rare.

## 5. Pacing and copy

- **Length.** Target 45-60 s. A say slide is about 5-7 s: typing runs at about 22 characters per second, and the
  punctuation pauses take extra time. A 110-character line fills a 6-7 s slide.
- **Line length.** `say` must be under 110 characters (the validator enforces it). Aim for under 90 characters in
  a dialogue line. Reason: a long line is typed faster and reads less naturally.
- **Punctuation** sets the voice: commas and full stops make pauses; a question ends with `?` so the voice rises.
  Write whole sentences, not lists of fragments.
- **One idea per slide.** If a slide needs two ideas, split it into two slides. Reason: the viewer reads one
  line and looks at one prop group.
- **Titles.** Keep a title card to a few words, and use it on the first slide. A short greeting (under 40
  characters) may go on the title slide: it is shown as a bottom caption. A slide with neither `say` nor
  `duration` is short, so give it `duration` 3-5.
- **Panels.** At most 4 bullets, each 22 characters or fewer. A panel slide may have a `say`: a line of about
  50 characters fits in a normal bubble beside the panel, a longer one becomes a bottom caption. Never put
  more than 2 props on a panel slide: a 4-bullet panel leaves almost no room below it.
- **Slide counts.** A dialogue line is a slide, so count lines, not blocks, toward the 6-9 target.
  Slides with a camera or panel often run longer than the text alone: check `duration` in the validator output.
- **Props.** 2-3 per slide (2 with a panel), in the order the story visits them. An `arrow` prop shows the
  direction of flow from one prop to the next, so put it between the two things it connects, and count it as
  a prop toward the 3. Reason: props placed
  left to right make the sequence readable without a caption.

## 5a. Crowding budget

The stage is only 240 x 135 pixels, and the speech, props, panel and characters share it. What the engine does
when a slide is too full (measured in a browser), and the budget that avoids it:

| Slide has | Fits normally | When it does not fit |
|---|---|---|
| 1 character + bubble | a line up to about 70 characters (4 lines) | long lines cover the scenery |
| 2 characters + bubble | up to 3 props with labels, a line under 70 characters | the speech becomes a bottom caption (2-3 lines, over the floor); labels are hidden first, then props are put in two rows, and only last are the final props dropped |
| a panel (3-4 bullets) | a line of about 50 characters, at most 2 props | the speech becomes a caption; props that cannot fit under the panel are not shown |
| a title card | a greeting under 40 characters | shown as a caption |
| 5-6 props | icons only (labels hidden), in two rows | the last props are dropped |

- A caption is fine as a style, but it covers the lower part of the characters. If `validate.js` says
  `crowded slide`, shorten the line or remove a prop.
- `labels hidden` means the props are too many for their labels. Use fewer props, shorter labels, or two slides.
- `props do not fit ... not shown` means the viewer will not see them: move them to another slide.
- Rule of thumb: if you are putting a panel, props and a long line on one slide, you want two slides.

## 5b. Tone and audience

Use what the user said about the audience; with nothing stated, write for a general reader. The characters
carry the tone, so the same facts can be a lecture or a story.

- **For kids:** one idea per slide, words a 7-year-old knows, a concrete comparison before any term ("your
  body is like a phone that needs charging"), and `playful` music. Keep the best joke to one slide.
- **Funny:** give the comic reactor (`frog`) the joke and the host (`penguin` or `bear`) the straight line. The
  pattern that fits in under 110 characters is setup, then reaction: the host states something, the frog
  answers in 1-2 short sentences with `surprised` or `facepalm`. Land the joke on a `punch-in` or an `emote`
  (`sweat`, `exclamation`), not on a long line. One joke per 2-3 slides; the rest is clear explanation.
- **For experts:** drop the comparisons, use the real term once and define it in the same line, `calm` or
  `upbeat` music, no jokes at the cost of accuracy.
- Never trade a correct fact for a joke: say the true thing, then react to it.

## 6. Sound

- **One music mood** for the whole scenario, set at the top level: `calm` for gentle science, `upbeat` for how-to
  and good news, `tense` for problems and risks, `playful` for light or kid-friendly topics. Change it per slide
  only for a real change of mood (`none` stops the loop). Reason: a music change every few slides sounds like a
  new scene each time.
- **2-4 sound effects in total** per scenario, counting every `sfx`, and every item of a list (the validator
  warns above 4). Reason: more effects stop meaning anything. Spend them where they matter: `appear` on the
  title card, one on the key moment, one on the outcome. The shipped examples use more; follow this rule.
- `appear` on the title card; `pop` only for a prop that is the point of the slide, with `{ "id", "at" }`
  matched to the prop's `delay`; `whoosh` on a `wipe` transition; `confirm` or `coin` on a good outcome;
  `error` on a problem; `talk` only on a chatty slide.
- Set `"voice": false` at the top level for a long dialogue with many lines if the blips become noise.

## 7. Common mistakes checklist

Check each item before running `validate.js`:

- [ ] Every slide with `say` has at most one speaker with `say`; a dialogue line is one speaker by design.
- [ ] No slide has more than 2 characters; a 3rd or 4th character starts a new dialogue block.
- [ ] Every `say` is under 110 characters; dialogue lines are under 90; lines on crowded slides under 70.
- [ ] No slide has more than 3 props (2 with a panel) plus a long line; `validate.js` shows no `crowded slide`,
      `labels hidden` or `props do not fit` note you did not mean.
- [ ] The JSON is strict: no `//` comments, no trailing commas.
- [ ] Every name (skin, background, prop, expression, pose, emote, action, transition, music, sfx) appears in
      `catalog.md`.
- [ ] `focus` is written with its `zoom` (`focus` alone zooms 2).
- [ ] No slide with a `title` or `panel` has `zoom` above 1.
- [ ] At most one camera move per slide; no two zoomed slides in a row outside a dialogue block.
- [ ] `shake` only on an error or a surprise.
- [ ] Panel: at most 4 bullets, each 22 characters or fewer.
- [ ] Props: 2-3 per slide (an `arrow` counts), in story order, and `at` values are `[x, y]` inside the 240 x 135 stage.
- [ ] One emote per character per slide, and it matches the words.
- [ ] Questions end with `?`.
- [ ] 2-4 sound effects in total; one music mood, changed only for a real change.
- [ ] The first slide is a title; the last slide is a recap or a cheer.
- [ ] The scenario totals 6-9 slides and about 45-60 s.
