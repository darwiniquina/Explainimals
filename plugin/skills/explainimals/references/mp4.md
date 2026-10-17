# MP4 export

`scripts/export_mp4.py` turns a built explainer into an MP4 video with sound. A script does all the work, so you only
run the command. Never write frames or audio yourself.

## Needs

- Python 3.8 or newer. If `python` is not found, try `python3` or `py -3`.
- `pip install playwright imageio-ffmpeg`, once. Ask the user before you install anything.
- Google Chrome or Microsoft Edge installed. Playwright drives the browser that is already there, so nothing else is
  downloaded. Only when neither is installed: `python -m playwright install chromium`.
- ffmpeg, either on PATH or supplied by the `imageio-ffmpeg` package.

Run `python <skill>/scripts/export_mp4.py --check` to see what is missing. It names each missing piece and prints the
install command. It exits 0 when everything is ready and 2 when not.

## Usage and options

```
python <skill>/scripts/export_mp4.py explainimals-output/topic.html
```

This writes `explainimals-output/topic.mp4` next to the HTML.

- `-o FILE`, `--out FILE`: output path (default: the HTML name with `.mp4`).
- `--width 960`, `1440` or `1920`: frame width in 16:9, default 1920. Each is a whole multiple of the 240x135 stage,
  so the pixel art stays sharp.
- `--hold SECONDS`: how long the last frame stays on screen (default 1).
- `--browser auto|chrome|msedge|chromium`: which browser to drive (default auto).
- `--ffmpeg PATH`: use this ffmpeg binary.
- `--no-audio`: video only, with no sound track.
- `--no-normalize`: keep the raw sound level (default is about -16 LUFS).
- `--check`: report what is missing and render nothing.

## How it works

The script opens the built `.html` in a headless browser and advances the presentation one engine step at a time. The
engine is deterministic and has a fixed-step mode for this, so each step is one screenshot of the stage. The music,
sound effects and character voices come from an offline Web Audio context that is clocked to the same steps, so
picture and sound line up exactly. Nothing runs in real time, and the audio is the player's own engine, not a
recording. ffmpeg then encodes H.264 video and AAC audio into one MP4. No network is used, and nothing is sent anywhere.

Only the stage is filmed: no player buttons, thumbnail strip or caption bar. Pause, speed and thumbnails exist only in
the HTML.

Output: H.264 and AAC, yuv420p, 24 fps (the engine draws 12 frames per second, and each frame is written twice),
faststart, sound normalised to about -16 LUFS. A 45 to 60 second presentation takes roughly a minute or two to render.
The file is small: about 2 MB at 960 wide for a 47 second explainer, and a few MB at 1920.

## Troubleshooting

- `python` not found: use `python3` or `py -3`.
- `--check` lists a missing piece: install what it prints, after the user says yes.
- No browser starts: install Chrome or Edge, or run `python -m playwright install chromium`.
- ffmpeg missing: run `pip install imageio-ffmpeg`, put ffmpeg on PATH, or pass `--ffmpeg PATH`.
- Video has no sound: the browser could not create audio, or `--no-audio` was used.
- Video is out of date: rebuild the `.html` with `build.js` after any scenario change, then export again. An old
  `.mp4` is not updated by itself.

For how the AI offers and runs the export, see step 8 in `SKILL.md`.
