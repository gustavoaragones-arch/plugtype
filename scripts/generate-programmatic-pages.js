#!/usr/bin/env node
/**
 * One-shot orchestration for static HTML under pages/, sitemap/.
 * Country pair guides at /compatibility/{origin}-to-{dest} are served by
 * Cloudflare Pages Functions only — no static files under /compatibility/.
 *
 * Run from project root: node scripts/generate-programmatic-pages.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

/** Remove all static /compatibility/* and /pages/compatibility/* (CF Functions own pair URLs). */
function removeAllStaticCompatibilityOutput() {
  for (const dir of [PAIR_GLOB_DIR, COMPAT_ROOT]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log('Removed static tree:', path.relative(PROJECT_ROOT, dir));
    }
  }
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
  console.log('=== Generated static file count (pages + sitemap; /compatibility is Functions-only) ===');
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

  removeAllStaticCompatibilityOutput();

  runNodeScript('generate-country-pages.js');
  runNodeScript('generate-plug-type-pages.js');

  if (false) {
    // Disabled: ~n*(n-1) country pair pages — exceeds CF Pages static file limits.
    runNodeScript('generate-compatibility-pages.js');
  }

  // Hub HTML under /compatibility/ removed — pair pages are Pages Functions only.
  runNodeScript('generate-html-sitemap.js');

  logGeneratedTreeCounts();
}

main();
