---
name: explainimals
description: Explainimals. Use when the user asks for an animated or pixel-art explainer, presentation, or video-style walkthrough with talking characters, or mentions Explainimals, for example "make an Explainimals about DNS" or "make a pixel explainer about DNS". Outputs one self-contained .html file that plays in any browser.
---

# Explainimals

## What this produces

One self-contained `.html` file: a retro 8/16-bit presentation with pixel characters (six skins) who talk in
speech bubbles, with props, backgrounds, camera moves and optional generated sound. You write a JSON scenario;
`scripts/validate.js` checks it and `scripts/build.js` packs the player and the scenario into one file.
`<skill>` below means this skill folder; `references/` and `scripts/` are inside it. Run the scripts by their
full path from any folder, for example `node <skill>/scripts/validate.js my-topic.json`. Needs Node 18 or newer.
On request it also makes an MP4 video of the explainer, with sound, using `scripts/export_mp4.py` (a Python script, step 8).

## Workflow

1. **Clarify.** Ask only if the topic is missing. Use the audience and tone the user states ("for kids",
   "funny", "for engineers"); with none, write for a general reader. Default length: 6-9 slides, 45-60 s.
2. **Read** `references/catalog.md` (every valid name; it ships ready, do not regenerate it) and
   `references/direction.md` (story shapes, cast, camera, pacing, tone).
3. **Plan, then confirm.** Before you write any JSON, show the user a short plan (6 lines at most) and ask ONE
   question. The plan has: the one-sentence takeaway, the audience and tone, the cast with each animal's role, the
   slide beats in order (a few words each, usually 6-9), the music arc (for example "calm, then tense at the
   problem, then upbeat"), the ending ("ends with the celebration fanfare" by default), and the expected length.
   If the user asks for a different ending sound, or none, set `finale` to `"none"`, `"keep"` or a mood name
   (see `references/scenario.md`, Sound) and say so in the plan. Never put `celebrate` on a slide yourself: the
   engine adds it to the last slide. Example question: "Build this, or change anything first?" Then wait for the answer. Fold any change they ask for into the plan and go on; ask
   again only if they changed the topic or the whole direction. Skip the wait only when the user said to just
   build it or not to ask questions (still show the plan in your reply), or when no one can answer (a
   non-interactive run).
4. **Write** the scenario as JSON to `explainimals-output/<topic-slug>.json`, a folder you create in the
   user's current working folder. Use only names from the catalog and only fields in `references/scenario.md`.
   The JSON must be strict: the `//` comments in the reference examples are not allowed.
5. **Validate:** `node <skill>/scripts/validate.js explainimals-output/<topic-slug>.json`. Fix every `ERROR`,
   read every `WARN` (each says what to change), and repeat until there are no errors and the warnings are
   either gone or deliberate. A WARN about a character the pixel font cannot draw must be fixed, not ignored
   (hard rule 9).
6. **Build:** `node <skill>/scripts/build.js explainimals-output/<topic-slug>.json -o explainimals-output/<topic-slug>.html`.
7. **Report and ask for revisions.** Do not end on the file path alone. Your final message has, in this order:
   (a) a summary of what the explainer says: 3-5 short bullets in the order the viewer sees them, each the point
   of a slide or a dialogue part, in plain words about the topic (not about JSON fields); (b) one line of facts:
   slide count, length in seconds, cast, music arc
   (for example calm, tense, upbeat, and the last slide plays the celebration or the `finale` that was set); (c) the
   full path of the `.html`, with a reminder to open it
   in a browser and press **Play** (sound stays off until then); (d) ONE question: what should change? Offer a few
   concrete options, such as shorter or longer, a different cast or tone, more or fewer jokes, different music, no
   camera moves, or fixing a specific slide (they can say "slide 4"). Add one more option to the same question: "or
   export it as an MP4 video" (step 8). Then wait. Do not rebuild until they answer.
   Follow "Revisions" below.
8. **MP4 (only when the user wants a video file).** Offer it in the step 7 question; if the user asked for an MP4 or
   a video file up front, do this right after the build and report both files. A script does all the work, not you:
   it plays the finished `.html` in a headless browser frame by frame, renders the same music, effects and voices
   offline, and encodes a 1920x1080 H.264 + AAC `.mp4` with ffmpeg. You only run commands; do not read the script,
   write frames or audio yourself, or re-run it to "check" it.
   (a) Check the tools: `python <skill>/scripts/export_mp4.py --check` (if `python` is not found, try `python3` or
   `py -3`, and use that same interpreter for every command below). It exits 0 when ready and 2 when something is
   missing, and it names each missing piece. Once `playwright` is installed it also starts a browser, so it reports a
   missing Chrome or Edge too.
   (b) If something is missing, say what, and ask before installing anything: `pip install playwright imageio-ffmpeg`
   (a few tens of MB, needs internet), and `python -m playwright install chromium` only when neither Chrome nor
   Edge is installed. The user's yes to the MP4 does not cover the install: ask separately. Install only after a yes. If they say no, stop and leave the `.html` as the result.
   (c) Export: `python <skill>/scripts/export_mp4.py explainimals-output/<topic-slug>.html` (use the full path when the
   `.html` is elsewhere). It writes
   `explainimals-output/<topic-slug>.mp4` and takes a minute or two for a typical explainer; run it in the
   background if your tool times out, and wait for it to finish. Use `--width 960` when they want a smaller or
   quicker file, and `--no-audio` for a silent video.
   (d) Report the `.mp4` path, its length and size (copy them from the script's last line). If it fails, show its last error line
   and, for a missing tool, repeat (b). `references/mp4.md` has the options and troubleshooting.

## Revisions

When the user asks for a change, edit the existing `explainimals-output/<topic-slug>.json` in place; do not
rewrite the scenario from scratch, and change only what they asked for. Run validate.js again (same rules as step
5), then build.js to the same `.html` path so there is always one current file. Say in one line what changed, then ask again whether anything else needs changing. If an `.mp4` of the old version
exists, also say it is out of date and offer to export it again. Stop only when the user says it is done ("looks good", "that's
it"). If a request conflicts with a hard rule (for example three characters on one slide), say so and offer the
nearest option that fits. Slide numbers the user gives are 1-based and count each `dialogue` line as its own slide.

## The 9 hard rules

1. One speaker with `say` per slide. For a conversation, use a `dialogue` block (one slide per line).
2. At most 2 characters on screen at once. A story with 3 or 4 characters is a chain of dialogue blocks with
   different casts (see `direction.md`, Cast); the three never stand together.
3. `say` is under 110 characters. Aim for under 90 in dialogue lines.
4. Keep slides uncrowded. With 2 characters on screen use at most 3 props and a line under 70 characters; with
   a `panel` use at most 2 props. When a slide is too full the engine shows the speech as a bottom caption, hides
   prop labels, or drops props, and `validate.js` says so (`crowded slide`, `labels hidden`, `props do not fit`).
   Treat those warnings as "split this slide in two", not as noise.
5. No `title` or `panel` on a slide whose `camera.zoom` is above 1.
6. Names come only from `references/catalog.md`. Any other value is a validation error.
7. At most one camera move per slide. Never two zoomed slides in a row, except lines of one dialogue block.
8. Panel: at most 4 bullets, each 22 characters or fewer. A `dialogue` slide has no `characters`, `character`
   or `say`, and every line expands to its own slide (a 4-line block is 4 slides).
9. All on-screen text (`say`, titles, panel bullets, prop labels) is plain ASCII: straight quotes, a plain
   hyphen, three dots, no emoji, no accented letters (write "cafe", "naive"). Spell out symbols: "TM", "EUR",
   "(c)". Fix every WARN from `validate.js` about a character the pixel font cannot draw before you run
   `build.js`. See `references/direction.md`, "Text the font can draw".

## References: when to read each file

- `references/catalog.md`: every valid background, prop, skin, expression, pose, emote, transition, music and
  sfx name. Read it before writing any name.
- `references/direction.md`: story shapes, cast roles, three-character stories, tone and humour, camera intents,
  pacing and sound. Read before writing slides.
- `references/scenario.md`: the full format (every field, camera, motion, dialogue, validation). Read when a field
  or option is unclear. Do not paste it into the reply.
- `references/audio.md`: music, sound effects and voices. Read only for sound or voice requests.
- `references/mp4.md`: the MP4 export script: needs, options, how it works, troubleshooting. Read only for video requests.
- `references/examples/*.js`: finished scenarios (JS wrappers around the same object). Read
  `code-review-chat.js` for dialogue and `how-claude-works-cinematic.js` for camera and motion.
- `references/contract.md`: art and engine rules for developers changing the runtime. Not needed to write a scenario.

## Minimal example (3 slides)

This shows the shape only. A real explainer has 6-9 slides, and `validate.js` warns when one runs short or long.

```json
{
  "title": "What is a server?",
  "music": "calm",
  "defaults": { "background": "meadow", "skin": "penguin" },
  "slides": [
    {
      "id": "title",
      "sfx": "appear",
      "duration": 4,
      "title": { "text": "What is a server?", "subtitle": "a pixel explainer" },
      "characters": [{ "skin": "penguin", "at": "left", "expression": "happy", "pose": "wave", "enter": "hop" }]
    },
    {
      "id": "idea",
      "props": ["laptop", "arrow", "server"],
      "characters": [
        { "skin": "penguin", "at": "left", "expression": "happy", "pose": "point_right",
          "say": "Your laptop sends a request. A server waits for it and sends back an answer." }
      ]
    },
    {
      "id": "recap",
      "sfx": "confirm",
      "panel": { "title": "Remember", "bullets": ["Waits for requests", "Sends answers back"] },
      "characters": [
        { "skin": "penguin", "at": "left", "expression": "joy", "pose": "cheer", "say": "That is a server." }
      ]
    }
  ]
}
```
