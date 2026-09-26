#!/usr/bin/env node
/*
 * `npm start` runs this: it brings the app up to date, then starts it.
 *
 * The update is a plain `git pull` of this repository, and only a
 * fast-forward: nothing local is ever merged or overwritten. Your settings,
 * hand-added NFTs and price history live in data/, which git ignores, so an
 * update never touches them. Offline, or not a git checkout (a downloaded
 * zip), the app simply starts as it is.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const here = __dirname;

if (fs.existsSync(path.join(here, '.git'))) {
  try {
    const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim();
    execFileSync('git', ['pull', '--ff-only', '--quiet'], { cwd: here, stdio: 'ignore', timeout: 30_000 });
    const after = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim();
    console.log(before === after ? '\n  Up to date.' : '\n  Updated to the latest version.');
  } catch {
    console.log('\n  Could not check for updates; starting the version here.');
  }
}

require('./server.js');
