#!/usr/bin/env node
/**
 * Generate /compatibility/{origin}/index.html — one hub per origin country.
 * Run from project root: node scripts/generate-country-hubs.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'pages', 'compatibility');
const COMPAT_DIR = path.join(PROJECT_ROOT, 'compatibility');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');

function loadCountries() {
  return JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
}

function parseFilename(name) {
  if (!name.endsWith('.html')) return null;
  const base = name.slice(0, -5);
  const idx = base.indexOf('-to-');
  if (idx === -1) return null;
  return {
    origin: base.slice(0, idx),
    dest: base.slice(idx + 4)
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main() {
  const countries = loadCountries();
  const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));

  const byOrigin = {};
  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) continue;
    if (!countries[parsed.origin] || !countries[parsed.dest]) continue;
    if (!byOrigin[parsed.origin]) byOrigin[parsed.origin] = [];
    byOrigin[parsed.origin].push(parsed.dest);
  }

  const originKeys = Object.keys(byOrigin).sort((a, b) =>
    (countries[a] && countries[b] ? countries[a].name.localeCompare(countries[b].name) : 0)
  );

  for (const originKey of originKeys) {
    const destKeys = [...new Set(byOrigin[originKey])].sort((a, b) =>
      (countries[a] && countries[b] ? countries[a].name.localeCompare(countries[b].name) : 0)
    );
    const originName = countries[originKey] ? countries[originKey].name : originKey;

    const links = destKeys.map(destKey => {
      const destName = countries[destKey] ? countries[destKey].name : destKey;
      const href = '/pages/compatibility/' + originKey + '-to-' + destKey + '.html';
      return '<li><a href="' + href + '">' + escapeHtml(originName) + ' \u2192 ' + escapeHtml(destName) + '</a></li>';
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Where Can You Use a ${escapeHtml(originName)} Plug? Compatibility Guides</title>
  <meta name="description" content="Browse plug compatibility guides from ${escapeHtml(originName)} to every country. See if you need an adapter or voltage converter.">
  <link rel="canonical" href="https://plugtype.world/compatibility/${originKey}/">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="hero">
    <h1>Where Can You Use a ${escapeHtml(originName)} Plug?</h1>
    <p class="tagline"><a href="/">← Compatibility tool</a> · <a href="/compatibility/">All compatibility guides</a></p>
  </header>

  <main class="hub-main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> \u2192 <a href="/compatibility/">Compatibility Guides</a> \u2192 ${escapeHtml(originName)}</nav>
    <h2>${escapeHtml(originName)} Plug Compatibility Guides</h2>
    <ul class="compatibility-grid">
${links}
    </ul>
  </main>

  <footer>
    <p><a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/sitemap/">HTML Sitemap</a></p>
    <p>Plug Type World is a product of Albor Digital LLC.</p>
  </footer>
</body>
</html>
`;

    const outDir = path.join(COMPAT_DIR, originKey);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  }

  console.log('Wrote', originKeys.length, 'country hub pages under /compatibility/');
}

main();
