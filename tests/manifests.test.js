'use strict';
// The marketplace and plugin manifests must point at the skill folder and agree on names and version.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, SKILL } = require('./helpers');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const marketplace = readJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
const entry = marketplace.plugins[0];
const pluginRoot = path.resolve(ROOT, entry.source);
const plugin = readJson(path.join(pluginRoot, '.claude-plugin', 'plugin.json'));

test('marketplace.json names the marketplace and its plugin "explainimals"', () => {
  assert.equal(marketplace.name, 'explainimals');
  assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length >= 1);
  assert.equal(entry.name, 'explainimals');
});

test('marketplace plugin source resolves to a folder with a plugin.json of the same name', () => {
  assert.ok(entry.source.startsWith('./'), 'source should be a relative path from the repo root');
  assert.ok(fs.statSync(pluginRoot).isDirectory(), `${pluginRoot} is not a folder`);
  assert.equal(plugin.name, entry.name);
});

test('plugin.json version is plain semver x.y.z', () => {
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
});

test('the plugin folder contains the skill SKILL.md', () => {
  assert.ok(fs.existsSync(path.join(SKILL, 'SKILL.md')));
});
