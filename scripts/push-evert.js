#!/usr/bin/env node
'use strict';

// Publishes the current committed state of m365-launcher/ to the `evert`
// branch on the public tenanthop repo (not main) — this is the branch your
// boss's checker watches. Once it passes his review, promotion to main is
// handled on his side, not by this script.
// Run with: npm run push-evert

const { execFileSync } = require('child_process');
const path = require('path');

const PKG_ROOT = path.resolve(__dirname, '..');   // m365-launcher/
const REPO_ROOT = path.resolve(PKG_ROOT, '..');    // outer git repo root
const REMOTE = 'tenanthop';
const BRANCH = 'evert';

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function tryCapture(cmd, args, opts = {}) {
  try {
    return { ok: true, output: execFileSync(cmd, args, { encoding: 'utf8', ...opts }) };
  } catch (err) {
    return { ok: false, err };
  }
}

function main() {
  const status = tryCapture('git', ['status', '--short', '--', 'm365-launcher'], { cwd: REPO_ROOT });
  if (status.ok && status.output.trim()) {
    console.error('There are uncommitted changes under m365-launcher/. Commit first:');
    console.error(status.output);
    process.exit(1);
  }

  console.log(`\nPublishing to ${REMOTE}/${BRANCH}...`);
  const tmpBranch = `push-evert-tmp-${Date.now()}`;
  run('git', ['subtree', 'split', '--prefix=m365-launcher', '-b', tmpBranch], { cwd: REPO_ROOT });
  try {
    run('git', ['push', REMOTE, `${tmpBranch}:${BRANCH}`], { cwd: REPO_ROOT });
  } finally {
    run('git', ['branch', '-D', tmpBranch], { cwd: REPO_ROOT });
  }

  console.log(`\nDone: https://github.com/Evert-vh/tenanthop/tree/${BRANCH}`);
}

main();
