# Pixel Explainer Studio

2D pixel-art characters and presentations for explainer videos. Plain HTML/JS, no build step, no runtime dependencies.
Pixel art is the one visual style of the project: every character, background, prop and UI piece is drawn from
whole pixels (no smooth vector art, no render filters).

## Run it

Serve the folder (opening `dashboard.html` directly also works):

```bash
python -m http.server 8765
```

Open http://localhost:8765/dashboard.html. The old `test-runner.html`, `presentation/player.html` and
`presentation/assets-preview.html` are now redirects to the matching dashboard section.

## The dashboard

One page, hash-routed, with a global character picker in the header (used by every section):

| Route | Section | What it does |
|---|---|---|
| `#/home` | Home | counts, the live crew, scenario cards with Play |
| `#/characters` | Characters | Playground (expression, pose, behaviour, part overrides, colours) and Gallery |
| `#/scenes` | Scenes | scene maker for one character: row builder + JSON editor, play, download/load `.json` |
| `#/presentations` | Presentations | scenario player: library, scrub, slides, JSON editor, fullscreen, `?scenario=ID&autoplay=1` |
| `#/assets` | Assets | backgrounds, props, pixel font and UI pieces, with filter and copy-name |

```
dashboard.html             page + script order
dashboard/dashboard.css    pixel UI and the shared px-* classes
dashboard/shell.js         window.Dashboard: register(), routing, skin picker, shared state
dashboard/views/*.js       home, characters, scenes, presentations, assets
```

Adding a section: write `dashboard/views/<id>.js` calling
`Dashboard.register({ id, title, order, mount(ctx) { ...; return cleanup; } })` and add a `<script>` tag to
`dashboard.html`. `ctx` gives you `root`, `query`, `state`, `on('skin', fn)`, `setStatus`, `navigate`.

## Characters

Six native pixel-art characters share one rig and one scene format. Each is a 61x76 grid drawn in code.

| Skin id | Character |
|---|---|
| `penguin` | Penguin, navy and cream with an orange beak |
| `frog` | Frog, green with eyes on top of a wide head |
| `dog` | Dog, brown floppy ears and a cream face stripe |
| `whisker` | Cat, a plain orange cat with whiskers and a curled tail |
| `rabbit` | Rabbit, tan-brown with tall ears |
| `bear` | Bear, warm brown with a cream muzzle and belly |

```
character/parts.js        shared vocabulary: expression and pose names, talk shapes
character/skin-*.js       one file per character (sprites authored as text grids, arms redrawn per angle)
character/character.js    the rig: new Character(el, { skin }).apply({...}); tick(dt)
```

Expression and pose names are the same for every skin, so one scene list drives any character. Unknown names
throw an error listing the valid ones. To add a character, copy the closest `skin-*.js`, change the art and the
colour-class prefix (class names are global), and add a `<script>` tag to `dashboard.html`
(plus the id to the six-skin list in `dashboard/shell.js`).

### Scene format

```json
{ "narration": "...", "expression": "happy", "pose": "wave", "talking": true,
  "look": { "x": 0.5, "y": 0 }, "eyes": "wide", "brows": "raised", "mouth": "O", "duration": 3 }
```

### Conventions

- `L` / `R` are the viewer's left / right.
- Arm angles: `s` = shoulder (0 down, 90 out to the side, 180 up).
- Time advances only through `tick(dt)`, so a frame-by-frame renderer gets identical output. Animation runs in fixed steps (default 12 fps).
- Motion is rounded to whole pixels.

## Presentations (scenario player)

A whole explainer is one JSON **scenario** (slides, characters, speech, props, panels, backgrounds); see
`presentation/SCENARIO.md` (format and authoring guide) and `presentation/CONTRACT.md` (240x135 stage, art rules).

```
presentation/pixel.js         Pres.Buf: the pixel buffer everything is drawn into
presentation/registry.js      registerBackground / registerProp / Pres.catalog()
presentation/font.js, ui.js   pixel font, speech bubble, bullet panel, title card, labels
presentation/backgrounds.js   7 retro scenes
presentation/props.js         22 retro icons
presentation/engine.js        Pres.validate(scenario) and Pres.Player (fixed 12 fps steps)
presentation/audio.js         Pres.audio: Web Audio music and sound effects (no files)
presentation/AUDIO.md         sound contract: API, scenario fields, UI
presentation/scenarios/       web-trip (penguin), sky-blue (cat + frog), how-claude-works (penguin, rabbit, bear, dog),
                             code-review-chat (all six characters, dialogue blocks: 'The code review')
```

`presentation/archive/` keeps earlier soft/pastel backgrounds, props and UI (`*.soft.js`); nothing loads them.
Art direction: retro 8/16-bit console look (limited saturated palette, dark outline, 2-3 tone shading, dithered
skies, square-cornered windows), no pastel pink/lavender, no kawaii details.

## Sound

Presentations have optional music and sound effects (`presentation/audio.js`, contract in `presentation/AUDIO.md`).
Everything is generated in the browser with the Web Audio API, so there are no audio files, downloads or licences
to track.

- Music moods: `calm`, `upbeat`, `tense`, `playful`. Sound effects (ten): `blip`, `pop`, `jump`, `coin`,
  `confirm`, `error`, `whoosh`, `typing`, `talk`, `appear`.
- Presentations view: a **Sound** button (toggles mute, shows On or Off), a volume slider, a "now playing" label,
  and the `M` key toggles mute. Sound is silent until you press Play.
- Assets view: a **Sounds** section to try each effect and each music track (with its bpm).
- Scenarios: a top-level `music` field and per-slide `music` and `sfx` fields. See `presentation/SCENARIO.md`.

**Talking.** A `say` line is typed out letter by letter in its speech bubble, and each character has its own voice: a short blip per letter, so the speaker seems to talk. Like the rest of the sound, the voices are generated in the browser with no files. The Assets view's **Sounds** section lets you hear the six voices.

**Conversations.** A scenario can be a conversation: a `dialogue` block lists the cast and the lines, and the engine turns each line into a slide (see `presentation/SCENARIO.md`). The voices are expressive too: a happy line sounds brighter, a sad one slower and lower, and a question rises at the end. The example scenario 'The code review' (`presentation/scenarios/code-review-chat.js`) is a three-part conversation with all six characters.

## Next steps

- Wrap `Character` and `Pres.Player` in a Remotion component (`tick(1 / fps)` per frame)
- Package the scenario authoring guide as a skill that turns a script into a scenario
