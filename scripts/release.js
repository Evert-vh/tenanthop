#!/usr/bin/env node
'use strict';

// Builds TenantHub, publishes the current commit to the public repo (via
// git subtree split), and creates a GitHub release with every artifact
// electron-updater needs (installer, blockmap, portable exe, latest.yml).
// Run with: npm run release

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PKG_ROOT = path.resolve(__dirname, '..');   // m365-launcher/
const REPO_ROOT = path.resolve(PKG_ROOT, '..');    // outer git repo root
const RELEASE_DIR = path.join(PKG_ROOT, 'release');
const MAIN_JS = path.join(PKG_ROOT, 'electron', 'main.js');
const REMOTE = 'tenanthop';
const REMOTE_REPO = 'Evert-vh/tenanthop';

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

// Parses every version block out of the CHANGELOG object in electron/main.js,
// in file order (oldest first — matches how entries get appended over time).
function parseChangelog() {
  const src = fs.readFileSync(MAIN_JS, 'utf8');
  const blockStart = src.indexOf('const CHANGELOG = {');
  const blockEnd = src.indexOf('\n};', blockStart);
  const body = src.slice(blockStart, blockEnd);
  return [...body.matchAll(/'(\d+\.\d+\.\d+)':\s*\[([\s\S]*?)\n {2}\],/g)].map(([, version, entriesText]) => ({
    version,
    entries: [...entriesText.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
      .map(m => m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n')),
  }));
}

// Cumulative release notes: current version's entries, then every earlier
// version's entries below it, newest first — so scrolling a release page
// shows history instead of just what changed in that one release.
function buildReleaseNotes(version) {
  const changelog = parseChangelog();
  const idx = changelog.findIndex(b => b.version === version);
  if (idx === -1) return null;
  return changelog.slice(0, idx + 1).reverse()
    .map(b => `## ${b.version}\n` + b.entries.map(e => `- ${e}`).join('\n'))
    .join('\n\n');
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;
  const tag = `v${version}`;
  console.log(`\nReleasing TenantHub ${tag}\n`);

  // Refuse to publish uncommitted changes — subtree split only picks up what's committed.
  const status = tryCapture('git', ['status', '--short', '--', 'm365-launcher'], { cwd: REPO_ROOT });
  if (status.ok && status.output.trim()) {
    console.error('There are uncommitted changes under m365-launcher/. Commit first:');
    console.error(status.output);
    process.exit(1);
  }

  // Refuse to clobber an existing tag/release — replacing assets under an
  // unchanged version doesn't help clients that already reported that version.
  const existing = tryCapture('gh', ['release', 'view', tag, '--repo', REMOTE_REPO]);
  if (existing.ok) {
    console.error(`Release ${tag} already exists on ${REMOTE_REPO}. Bump the version in package.json first.`);
    process.exit(1);
  }

  const notes = buildReleaseNotes(version);
  if (!notes) {
    console.error(`No CHANGELOG['${version}'] entry found in electron/main.js — add one before releasing.`);
    process.exit(1);
  }

  console.log('Building...');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'package'], { cwd: PKG_ROOT });

  const assets = [
    path.join(RELEASE_DIR, `TenantHub-Setup-${version}.exe`),
    path.join(RELEASE_DIR, `TenantHub-Setup-${version}.exe.blockmap`),
    path.join(RELEASE_DIR, 'TenantHub-portable.exe'),
    path.join(RELEASE_DIR, 'latest.yml'),
  ];
  for (const f of assets) {
    if (!fs.existsSync(f)) {
      console.error(`Expected build artifact missing: ${f}`);
      process.exit(1);
    }
  }

  console.log('\nPublishing source to the public repo...');
  const tmpBranch = `tenanthop-release-${version}`;
  run('git', ['subtree', 'split', '--prefix=m365-launcher', '-b', tmpBranch], { cwd: REPO_ROOT });
  try {
    run('git', ['push', REMOTE, `${tmpBranch}:main`], { cwd: REPO_ROOT });
  } finally {
    run('git', ['branch', '-D', tmpBranch], { cwd: REPO_ROOT });
  }

  console.log('\nCreating GitHub release...');
  run('gh', [
    'release', 'create', tag,
    ...assets,
    '--repo', REMOTE_REPO,
    '--title', `TenantHub ${version}`,
    '--notes', notes,
  ]);

  console.log(`\nDone: https://github.com/${REMOTE_REPO}/releases/tag/${tag}`);
}

module.exports = { parseChangelog, buildReleaseNotes };

if (require.main === module) main();
