'use strict';
/*
 * load-runtime.js - loads the browser-only pixel presentation engine into a Node vm context.
 *
 * The runtime files under runtime/ are classic scripts that attach to `window` (no ES modules, no DOM
 * work at load time). This module evaluates them, in the order the contract needs, inside a fresh
 * context, so the engine can validate scenarios and list the catalog without a browser. Every call
 * creates a new context, so one scenario never leaks state into another.
 *
 *   const { loadRuntime, createRuntime } = require('./lib/load-runtime');
 *   const Pres = loadRuntime();                 // the Pres object: Pres.validate, Pres.catalog, ...
 *   const { Pres: P, window } = createRuntime(); // also exposes window.Character and the context
 *
 * Only the names the engine touches at load time are stubbed. DOM and animation calls are only made
 * when a Player is built or played, which validation never does.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RUNTIME_DIR = path.resolve(__dirname, '..', '..', 'runtime');

// Load order matters: every file expects the ones before it (see references/contract.md).
const FILES = [
  'character/parts.js',
  'character/skin-penguin.js',
  'character/skin-frog.js',
  'character/skin-dog.js',
  'character/skin-whisker.js',
  'character/skin-rabbit.js',
  'character/skin-bear.js',
  'character/character.js',
  'presentation/pixel.js',
  'presentation/registry.js',
  'presentation/font.js',
  'presentation/ui.js',
  'presentation/backgrounds.js',
  'presentation/props.js',
  'presentation/emotes.js',
  'presentation/audio.js',
  'presentation/engine.js',
];

// A do-nothing element for code that builds DOM nodes. Nothing is ever shown, so it only has to exist.
function stubElement() {
  return {
    style: {},
    dataset: {},
    className: '',
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [],
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild(child) { return child; },
    append() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

// Builds a context with the browser globals the runtime may reference, evaluates every runtime file in
// order and returns { Pres, window, context }. `window` is the context's global object, so
// `window.Character`, `window.CharacterSkins` and `window.Pres` are all reachable from Node.
function createRuntime() {
  const sandbox = {
    document: {
      createElement: () => stubElement(),
      createElementNS: () => stubElement(),
      createTextNode: (text) => ({ textContent: String(text) }),
    },
    requestAnimationFrame: () => 0,              // only used while a Player plays
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },      // only used while a Player plays
    console,
    // no AudioContext and no localStorage: audio.js detects both and stays silent
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  for (const rel of FILES) {
    const file = path.join(RUNTIME_DIR, rel);
    if (!fs.existsSync(file)) throw new Error(`runtime file missing: ${file}`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  }

  if (!sandbox.Pres || typeof sandbox.Pres.validate !== 'function') {
    throw new Error('runtime loaded but window.Pres.validate is missing');
  }
  return { Pres: sandbox.Pres, window: sandbox, context: sandbox };
}

// The Pres object of a fresh runtime.
function loadRuntime() {
  return createRuntime().Pres;
}

module.exports = { loadRuntime, createRuntime, RUNTIME_DIR, FILES };
