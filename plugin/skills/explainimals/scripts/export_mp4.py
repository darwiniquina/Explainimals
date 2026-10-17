#!/usr/bin/env python3
"""export_mp4.py - turns a built Explainimals presentation (.html) into an MP4 with sound.

    python export_mp4.py presentation.html [-o presentation.mp4] [--width 1920] [--check]

No AI is involved in the conversion: this script drives a headless browser through the presentation one
engine step at a time (the engine is deterministic and meant to be stepped like this), screenshots every
step, renders the sound with an offline Web Audio context at the exact same moments, and lets ffmpeg
encode and mux both. What you hear is what the HTML plays; it just does not run in real time.

Needs (checked first, with install hints if missing):
  - Python 3.8+ and the `playwright` package            pip install playwright
  - Chrome or Edge installed (Playwright drives it)     else: python -m playwright install chromium
  - ffmpeg on PATH, or the `imageio-ffmpeg` package     pip install imageio-ffmpeg

Exit codes: 0 written (or --check passed), 1 error, 2 usage or missing dependency.
"""
import argparse
import base64
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

STAGE_W, STAGE_H = 240, 135          # the engine's logical stage; the video is an integer multiple of it
WIDTHS = (960, 1440, 1920)
INSTALL_HINT = "pip install playwright imageio-ffmpeg"
BROWSER_HINT = "Install Google Chrome or Microsoft Edge, or run: python -m playwright install chromium"

# Runs in the page before any script of the presentation. It swaps Web Audio for an offline context whose
# clock is ours, so the real audio engine (runtime/presentation/audio.js) schedules music, effects and speech
# blips at the exact video times, and the whole soundtrack renders in a moment at the end.
INIT_JS = r"""
(() => {
  const SR = 44100;
  const timers = [];
  window.setInterval = (fn) => { timers.push(fn); return timers.length; };
  window.clearInterval = (id) => { if (id > 0 && id <= timers.length) timers[id - 1] = null; };
  window.__exTimers = () => { timers.slice().forEach((f) => { if (f) { try { f(); } catch (e) { /* ignore */ } } }); };
  window.__exNow = 0;
  window.__exSeconds = 60;
  // the offline graph is rendered once at the end, so a node disconnected "later" would vanish from the start
  if (window.AudioNode) window.AudioNode.prototype.disconnect = function () {};
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  window.AudioContext = window.webkitAudioContext = function () {
    const real = new Offline(1, Math.ceil(SR * window.__exSeconds), SR);
    window.__exCtx = real;
    return new Proxy(real, {
      get(t, k) {
        if (k === 'currentTime') return window.__exNow;
        if (k === 'state') return 'running';
        if (k === 'resume') return () => Promise.resolve();
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  };
})();
"""

# Defines the helpers the script calls once the page has loaded.
HARNESS_JS = r"""
(() => {
  const P = window.Pres;
  window.__exInit = (width, height) => {
    if (!P || typeof P.Player !== 'function') throw new Error('this file has no Explainimals player in it');
    const keys = Object.keys(P.scenarios || {});
    let scenario = null, errors = [];
    for (const k of keys) {
      const r = P.validate(P.scenarios[k]);
      if (!r.errors.length) { scenario = P.scenarios[k]; break; }
      errors = r.errors;
    }
    if (!scenario) throw new Error(keys.length ? 'the scenario does not validate: ' + errors.join('; ') : 'no scenario in this file');
    Array.from(document.body.children).forEach((el) => { el.style.display = 'none'; });
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:' + width + 'px;height:' + height + 'px;background:#000;z-index:2147483647;overflow:hidden;';
    const holder = document.createElement('div');
    box.append(holder);
    document.body.append(box);
    const player = new P.Player(holder, { loop: false });
    player.load(scenario);
    player._layout();
    window.__ex = { player: player };
    return { fps: player.fps, total: player.duration, k: player.k, slides: player.sc.slides.length, title: scenario.title || '' };
  };
  window.__exStart = () => {
    const p = window.__ex.player;
    p._rafOn = true;                 // we step by hand: keep the real-time loop from starting
    p.acc = 0;
    window.__exNow = 0;
    p.play();                        // unlocks the (offline) audio and starts slide 1's music
  };
  window.__exStep = (n, fps) => {
    const p = window.__ex.player;
    window.__exNow = n / fps;
    p.step(1 / fps);
    window.__exTimers();
    return p.playing;
  };
  window.__exAudio = async () => {
    if (!window.__exCtx) return null;
    const buf = await window.__exCtx.startRendering();
    const d = buf.getChannelData(0), out = new Int16Array(d.length);
    let peak = 0;
    for (let i = 0; i < d.length; i++) {
      const s = Math.max(-1, Math.min(1, d[i]));
      if (Math.abs(s) > peak) peak = Math.abs(s);
      out[i] = s < 0 ? s * 32768 : s * 32767;
    }
    const bytes = new Uint8Array(out.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { rate: buf.sampleRate, peak: peak, b64: btoa(bin) };
  };
})();
"""


class Fail(Exception):
    """A problem to tell the user about (no traceback)."""

    def __init__(self, message, code=1):
        super().__init__(message)
        self.code = code


def log(msg):
    print(msg, flush=True)


def find_ffmpeg(explicit):
    if explicit:
        if not Path(explicit).is_file():
            raise Fail("ffmpeg not found at %s" % explicit, 2)
        return explicit
    env = os.environ.get("EXPLAINIMALS_FFMPEG")
    if env and Path(env).is_file():
        return env
    on_path = shutil.which("ffmpeg")
    if on_path:
        return on_path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise Fail("ffmpeg was not found. Install it (https://ffmpeg.org) or run: pip install imageio-ffmpeg", 2)


def import_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        raise Fail("the Python package `playwright` is missing. Run: %s" % INSTALL_HINT, 2)


def launch_browser(pw, choice):
    """Open a headless Chromium: the installed Chrome or Edge first (nothing to download), then Playwright's own."""
    args = ["--hide-scrollbars", "--force-device-scale-factor=1"]
    order = {"auto": ["chrome", "msedge", None], "chrome": ["chrome"], "msedge": ["msedge"], "chromium": [None]}[choice]
    last = None
    for channel in order:
        try:
            if channel:
                return pw.chromium.launch(channel=channel, headless=True, args=args)
            return pw.chromium.launch(headless=True, args=args)
        except Exception as e:                      # not installed: try the next one
            last = e
    raise Fail("no browser could be started. %s\n(%s)" % (BROWSER_HINT, str(last).strip().splitlines()[0] if last else ""), 2)


def run(cmd, what):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-6:]
        raise Fail("%s failed:\n  %s" % (what, "\n  ".join(tail)))
    return p


def export(src, out, width, browser, ffmpeg, hold, audio_on, normalize):
    sync_playwright = import_playwright()
    height = width * STAGE_H // STAGE_W
    started = time.time()
    tmp = Path(tempfile.mkdtemp(prefix="explainimals-mp4-"))
    try:
        with sync_playwright() as pw:
            br = launch_browser(pw, browser)
            try:
                ctx = br.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
                page = ctx.new_page()
                page.add_init_script(INIT_JS)
                problems = []
                page.on("pageerror", lambda e: problems.append(str(e)))
                page.goto(src.as_uri(), wait_until="load")
                page.evaluate(HARNESS_JS)
                try:
                    info = page.evaluate("([w, h]) => window.__exInit(w, h)", [width, height])
                except Exception as e:
                    first = str(e).strip().splitlines()[0] if str(e).strip() else "the presentation could not be started"
                    raise Fail(first.replace("Page.evaluate: ", "").replace("Error: ", "", 1))
                fps, total = int(info["fps"]), float(info["total"])
                if info["k"] * STAGE_W != width:
                    raise Fail("the stage scaled to x%s, not x%d; try another --width" % (info["k"], width // STAGE_W))
                steps = int(round(total * fps))
                hold_frames = int(round(hold * fps))
                log("%s: %d slides, %.1f s, %d x %d, %d engine frames per second" % (info["title"] or src.name, info["slides"], total, width, height, fps))

                page.evaluate("(s) => { window.__exSeconds = s; }", total + hold + 1.0)
                page.evaluate("() => window.__exStart()")

                out_fps = fps * max(1, -(-24 // fps))           # a whole multiple of the engine rate, at least 24
                silent = tmp / "video.mp4"
                enc = subprocess.Popen(
                    [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png", "-i", "-",
                     "-vf", "fps=%d" % out_fps, "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-tune", "animation",
                     "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent)],
                    stdin=subprocess.PIPE, stderr=subprocess.PIPE)
                clip = {"x": 0, "y": 0, "width": width, "height": height}
                frame, last, shown = 0, None, -1
                try:
                    playing = True
                    while True:
                        last = page.screenshot(type="png", clip=clip)
                        enc.stdin.write(last)
                        frame += 1
                        if not playing or frame > steps + fps * 5:      # the engine ended (or something is wrong)
                            break
                        playing = page.evaluate("([n, f]) => window.__exStep(n, f)", [frame, fps])
                        pct = int(100 * frame / max(1, steps))
                        if pct // 10 != shown // 10:
                            shown = pct
                            log("  frames %d%%" % min(pct, 100))
                    for _ in range(hold_frames):
                        enc.stdin.write(last)
                        frame += 1
                    enc.stdin.close()
                except BrokenPipeError:
                    pass
                err = enc.stderr.read().decode("utf-8", "replace").strip()
                if enc.wait() != 0:
                    raise Fail("ffmpeg could not encode the frames:\n  " + "\n  ".join(err.splitlines()[-6:]))

                duration = frame / fps
                audio = page.evaluate("() => window.__exAudio()") if audio_on else None
                if problems:
                    log("  page reported: " + problems[0])
            finally:
                br.close()

        out.parent.mkdir(parents=True, exist_ok=True)
        if audio and audio["peak"] > 0.0005:
            raw = tmp / "audio.raw"
            raw.write_bytes(base64.b64decode(audio["b64"]))
            af = "loudnorm=I=-16:TP=-1.5:LRA=11," if normalize else ""
            af += "atrim=0:%.3f" % duration
            run([ffmpeg, "-y", "-loglevel", "error", "-i", str(silent), "-f", "s16le", "-ar", str(int(audio["rate"])), "-ac", "1", "-i", str(raw),
                 "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
                 "-movflags", "+faststart", str(out)], "ffmpeg (adding the sound)")
            sound = "with sound (peak %.2f)" % audio["peak"]
        else:
            shutil.copyfile(silent, out)
            sound = "without sound" + ("" if not audio_on else " (the presentation made none)")
        log("wrote %s: %.1f s, %s, %.1f MB, in %.0f s" % (out, duration, sound, out.stat().st_size / 1e6, time.time() - started))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def check(browser, ffmpeg_arg):
    """Report what is missing without exporting anything."""
    missing = []
    try:
        sync_playwright = import_playwright()
    except Fail as e:
        missing.append(str(e))
        sync_playwright = None
    try:
        log("ffmpeg: " + find_ffmpeg(ffmpeg_arg))
    except Fail as e:
        missing.append(str(e))
    if sync_playwright:
        try:
            with sync_playwright() as pw:
                launch_browser(pw, browser).close()
            log("browser: ok")
        except Fail as e:
            missing.append(str(e))
    if missing:
        for m in missing:
            log("missing: " + m)
        raise Fail("MP4 export is not ready", 2)
    log("ready: MP4 export has everything it needs")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Turn a built Explainimals .html into an MP4 with sound.")
    ap.add_argument("html", nargs="?", help="the built presentation (.html)")
    ap.add_argument("-o", "--out", help="output file (default: next to the html, same name, .mp4)")
    ap.add_argument("--width", type=int, default=1920, choices=WIDTHS, help="video width in pixels, 16:9 (default 1920)")
    ap.add_argument("--hold", type=float, default=1.0, help="seconds to keep the last frame (default 1)")
    ap.add_argument("--browser", default="auto", choices=("auto", "chrome", "msedge", "chromium"), help="which browser to drive")
    ap.add_argument("--ffmpeg", help="path to ffmpeg (default: PATH, then imageio-ffmpeg)")
    ap.add_argument("--no-audio", action="store_true", help="video only")
    ap.add_argument("--no-normalize", action="store_true", help="keep the raw sound level (default: about -16 LUFS)")
    ap.add_argument("--check", action="store_true", help="only check that everything needed is installed")
    args = ap.parse_args(argv)
    try:
        if args.check:
            check(args.browser, args.ffmpeg)
            return 0
        if not args.html:
            ap.print_usage(sys.stderr)
            print("error: give the built .html file (or use --check)", file=sys.stderr)
            return 2
        src = Path(args.html).resolve()
        if not src.is_file() or src.suffix.lower() not in (".html", ".htm"):
            raise Fail("not a built presentation (.html): %s" % src, 2)
        out = Path(args.out).resolve() if args.out else src.with_suffix(".mp4")
        export(src, out, args.width, args.browser, find_ffmpeg(args.ffmpeg), max(0.0, args.hold), not args.no_audio, not args.no_normalize)
        return 0
    except Fail as e:
        print("error: %s" % e, file=sys.stderr)
        return e.code
    except KeyboardInterrupt:
        print("cancelled", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
