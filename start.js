#!/usr/bin/env node
/*
 * `npm start` runs this. It keeps the app up to date and running:
 *
 *   1. brings the checkout up to date (a fast-forward `git pull`);
 *   2. starts the app as a child process;
 *   3. when the app asks to be updated -- the page's "Update now", or an
 *      update found while nobody is looking at it -- the app exits with
 *      UPDATE_EXIT, and this goes back to step 1.
 *
 * Nothing local is ever merged or overwritten, and data/ (your wallets,
 * hand-added NFTs, price history) is ignored by git, so an update never
 * touches it. Offline, or not a git checkout (a downloaded zip), the app
 * simply starts as it is.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const here = __dirname;
const UPDATE_EXIT = 75;

function update() {
  if (!fs.existsSync(path.join(here, '.git'))) return;
  try {
    const git = (args) => execFileSync('git', args, { cwd: here, encoding: 'utf8', timeout: 30_000 }).trim();
    const before = git(['rev-parse', 'HEAD']);
    execFileSync('git', ['pull', '--ff-only', '--quiet'], { cwd: here, stdio: 'ignore', timeout: 30_000 });
    const after = git(['rev-parse', 'HEAD']);
    if (before === after) {
      console.log('\n  Up to date.');
      return;
    }
    // What came in, for the page to show once: the commits' titles.
    const changes = git(['log', '--format=%s', `${before}..${after}`])
      .split('\n').map((line) => line.trim()).filter(Boolean);
    fs.mkdirSync(path.join(here, 'data'), { recursive: true });
    fs.writeFileSync(path.join(here, 'data', 'last-update.json'), JSON.stringify({ at: Date.now(), changes }, null, 2));
    console.log('\n  Updated to the latest version:');
    for (const change of changes) console.log(`   - ${change}`);
  } catch {
    console.log('\n  Could not check for updates; starting the version here.');
  }
}

function run() {
  update();
  const child = spawn(process.execPath, [path.join(here, 'server.js')], {
    cwd: here,
    stdio: 'inherit',
    // The app offers "Update now" only when something is here to restart it.
    env: { ...process.env, NFT_PORTFOLIO_SUPERVISED: '1' },
  });
  child.on('exit', (code, signal) => {
    if (code === UPDATE_EXIT) {
      console.log('\n  Restarting with the update…');
      run();
      return;
    }
    process.exit(signal ? 1 : code || 0);
  });
}

// Ctrl+C reaches both processes; this one just waits for the app to close.
process.on('SIGINT', () => {});
run();
