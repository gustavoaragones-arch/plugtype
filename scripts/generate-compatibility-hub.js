#!/usr/bin/env node
/**
 * Generate /compatibility/index.html — crawl hub linking to all compatibility pages.
 * Run from project root: node scripts/generate-compatibility-hub.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(PROJECT_ROOT, 'pages', 'compatibility');
const HUB_DIR = path.join(PROJECT_ROOT, 'compatibility');
const HUB_FILE = path.join(HUB_DIR, 'index.html');
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

  const originCountryLinks = originKeys.map(originKey => {
    const name = countries[originKey] ? countries[originKey].name : originKey;
    return '<li><a href="/compatibility/' + originKey + '/">' + escapeHtml(name) + '</a></li>';
  }).join('\n');

  let sections = '<h2>Compatibility Guides by Origin Country</h2>\n<ul class="origin-country-list">\n' + originCountryLinks + '\n</ul>\n';
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
    sections += '<h2>Compatibility Guides from ' + escapeHtml(originName) + '</h2>\n<ul class="compatibility-grid">\n' + links + '\n</ul>\n';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Global Plug Compatibility Guides by Country</title>
  <meta name="description" content="Browse all international plug adapter compatibility guides. See if your plug works in another country and whether you need a voltage converter.">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="hero">
    <h1>Global Plug Compatibility Guides</h1>
    <p class="tagline"><a href="/">← Compatibility tool</a></p>
  </header>

  <main class="hub-main">
    <p class="hub-intro">Select your home country to see where your plug will work around the world.</p>
    ${sections}
  </main>

  <footer>
    <p><a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/sitemap/">HTML Sitemap</a></p>
    <p>Plug Type World is a product of Albor Digital LLC.</p>
  </footer>
</body>
</html>
`;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (!fs.existsSync(HUB_DIR)) fs.mkdirSync(HUB_DIR, { recursive: true });
  fs.writeFileSync(HUB_FILE, html, 'utf8');
  console.log('Wrote', HUB_FILE);
  console.log('Origin sections:', originKeys.length);
  console.log('Total links:', files.length);
}

main();
