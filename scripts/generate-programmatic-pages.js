#!/usr/bin/env node
/**
 * One-shot orchestration for static HTML under pages/, compatibility/, sitemap/.
 * Compatibility pair pages (origin-to-destination) are disabled to stay under
 * Cloudflare Pages file limits; country pages, plug-type pages, and hubs stay.
 *
 * Run from project root: node scripts/generate-programmatic-pages.js
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PAIR_GLOB_DIR = path.join(PROJECT_ROOT, 'pages', 'compatibility');
const COMPAT_ROOT = path.join(PROJECT_ROOT, 'compatibility');

function runNodeScript(relativePath) {
  const script = path.join(PROJECT_ROOT, 'scripts', relativePath);
  const r = spawnSync(process.execPath, [script], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  if (r.status !== 0) {
    throw new Error(`Script failed (${r.status}): ${relativePath}`);
  }
}

/** Remove all static pair pages: pages/compatibility/{origin}-to-{dest}.html */
function removeCompatibilityPairPages() {
  if (!fs.existsSync(PAIR_GLOB_DIR)) return;
  execSync(`find "${PAIR_GLOB_DIR}" -type f -name '*-to-*.html' -delete`, { stdio: 'inherit' });
  const left = fs.readdirSync(PAIR_GLOB_DIR).filter(f => f.endsWith('.html') && f.includes('-to-'));
  console.log(
    'Compatibility pair pages removed (*-to-*.html). Remaining pair-like files:',
    left.length
  );
}

/** Drop per-origin hubs under /compatibility/{slug}/ — they are derived from pair pages. */
function removeStaleOriginHubDirs() {
  if (!fs.existsSync(COMPAT_ROOT)) return;
  let removed = 0;
  for (const name of fs.readdirSync(COMPAT_ROOT, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    fs.rmSync(path.join(COMPAT_ROOT, name.name), { recursive: true, force: true });
    removed++;
  }
  console.log('Removed', removed, 'per-origin hub directories under /compatibility/');
}

function countFilesRecursive(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) countFilesRecursive(p, acc);
    else acc.push(p);
  }
}

function listAllFilesUnder(dir) {
  const files = [];
  countFilesRecursive(dir, files);
  return files;
}

function logGeneratedTreeCounts() {
  const roots = [
    path.join(PROJECT_ROOT, 'pages'),
    path.join(PROJECT_ROOT, 'compatibility'),
    path.join(PROJECT_ROOT, 'sitemap')
  ];
  const byRoot = roots.map(r => ({ rel: path.relative(PROJECT_ROOT, r), files: listAllFilesUnder(r) }));
  const total = byRoot.reduce((s, x) => s + x.files.length, 0);
  console.log('');
  console.log('=== Generated static file count (pages + compatibility + sitemap) ===');
  for (const { rel, files } of byRoot) {
    console.log(`  ${rel}/: ${files.length}`);
  }
  console.log('Total files:', total);
  if (total >= 15000) {
    console.warn('WARNING: total is still >= 15,000. Trim additional generators or assets.');
    process.exitCode = 1;
  } else {
    console.log('OK: total < 15,000');
  }
}

function main() {
  process.chdir(PROJECT_ROOT);

  removeCompatibilityPairPages();
  removeStaleOriginHubDirs();

  runNodeScript('generate-country-pages.js');
  runNodeScript('generate-plug-type-pages.js');

  if (false) {
    // Disabled: ~n*(n-1) country pair pages — exceeds CF Pages static file limits.
    runNodeScript('generate-compatibility-pages.js');
  }

  runNodeScript('generate-compatibility-hub.js');
  runNodeScript('generate-country-hubs.js');
  runNodeScript('generate-html-sitemap.js');

  logGeneratedTreeCounts();
}

main();
