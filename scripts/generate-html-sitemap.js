#!/usr/bin/env node
/**
 * Generate /sitemap/index.html — human-readable HTML sitemap.
 * Run from project root: node scripts/generate-html-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITEMAP_DIR = path.join(PROJECT_ROOT, 'sitemap');
const SITEMAP_FILE = path.join(SITEMAP_DIR, 'index.html');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');

const plugLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];

const COMPAT_ORIGIN_KEYS = [
  'united-states', 'canada', 'united-kingdom', 'australia', 'germany', 'france', 'spain', 'italy',
  'brazil', 'japan', 'india', 'netherlands', 'sweden', 'switzerland', 'singapore', 'south-korea',
  'mexico', 'thailand', 'philippines', 'south-africa'
];

// Popular compatibility guides (origin, dest) — ~25 links
const POPULAR_COMPAT = [
  ['united-states', 'italy'], ['united-states', 'france'], ['united-states', 'japan'], ['united-states', 'united-kingdom'], ['united-states', 'mexico'],
  ['canada', 'japan'], ['canada', 'united-kingdom'], ['canada', 'italy'], ['canada', 'mexico'], ['canada', 'france'],
  ['united-kingdom', 'thailand'], ['united-kingdom', 'spain'], ['united-kingdom', 'france'], ['united-kingdom', 'japan'], ['united-kingdom', 'australia'],
  ['australia', 'japan'], ['australia', 'united-kingdom'], ['australia', 'thailand'], ['australia', 'united-states'],
  ['germany', 'spain'], ['germany', 'italy'], ['france', 'spain'], ['japan', 'united-states'], ['japan', 'thailand'],
  ['mexico', 'united-states'], ['thailand', 'united-kingdom'], ['south-korea', 'japan']
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main() {
  const countries = JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
  const countryKeys = Object.keys(countries).sort((a, b) =>
    (countries[a].name || '').localeCompare(countries[b].name || '')
  );

  // Section 1: Main Pages
  const mainPages = `
    <li><a href="/">Home</a></li>
    <li><a href="/compatibility/">Compatibility Guides</a></li>
    <li><a href="/plug-types/">Plug Types</a></li>
    <li><a href="/countries/">Country Plug Standards</a></li>
  `.trim().replace(/^/gm, '    ');

  // Section 2: Country Pages (alphabetically by name)
  const countryLinks = countryKeys.map(key => {
    const name = countries[key] ? countries[key].name : key;
    return `<li><a href="/pages/countries/${key}.html">${escapeHtml(name)} Plug Type</a></li>`;
  }).join('\n');

  // Section 3: Plug Types
  const plugLinks = plugLetters.map(letter => {
    const cap = letter.toUpperCase();
    return `<li><a href="/pages/plug-types/type-${letter}.html">Type ${cap} Plug</a></li>`;
  }).join('\n');

  // Section 4: Compatibility Country Hubs (alphabetically by country name)
  const hubOriginKeys = [...COMPAT_ORIGIN_KEYS].sort((a, b) =>
    (countries[a] && countries[b] ? countries[a].name.localeCompare(countries[b].name) : 0)
  );
  const hubLinks = hubOriginKeys.filter(k => countries[k]).map(key => {
    const name = countries[key].name;
    return `<li><a href="/compatibility/${key}/">${escapeHtml(name)} Compatibility Guides</a></li>`;
  }).join('\n');

  // Section 5: Popular Compatibility Guides
  const popularLinks = POPULAR_COMPAT.map(([orig, dest]) => {
    const oName = countries[orig] ? countries[orig].name : orig;
    const dName = countries[dest] ? countries[dest].name : dest;
    return `<li><a href="/pages/compatibility/${orig}-to-${dest}.html">${escapeHtml(oName)} \u2192 ${escapeHtml(dName)} Plug Adapter</a></li>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plug Type World HTML Sitemap</title>
  <meta name="description" content="Browse all pages on Plug Type World including plug compatibility guides, country plug types, and travel adapter information.">
  <link rel="canonical" href="https://plugtype.world/sitemap/">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="hero">
    <h1>Plug Type World HTML Sitemap</h1>
    <p class="tagline"><a href="/">← Compatibility tool</a></p>
  </header>

  <main class="hub-main sitemap-main">
    <section class="sitemap-section">
      <h2>Main Pages</h2>
      <ul>
${mainPages}
      </ul>
    </section>

    <section class="sitemap-section">
      <h2>Country Plug Standards</h2>
      <ul>
${countryLinks}
      </ul>
    </section>

    <section class="sitemap-section">
      <h2>Plug Types</h2>
      <ul>
${plugLinks}
      </ul>
    </section>

    <section class="sitemap-section">
      <h2>Compatibility Guides by Country</h2>
      <ul>
${hubLinks}
      </ul>
    </section>

    <section class="sitemap-section">
      <h2>Popular Compatibility Guides</h2>
      <ul>
${popularLinks}
      </ul>
    </section>
  </main>

  <footer>
    <p><a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/sitemap/">HTML Sitemap</a></p>
    <p>Plug Type World is a product of Albor Digital LLC.</p>
  </footer>
</body>
</html>
`;

  if (!fs.existsSync(SITEMAP_DIR)) fs.mkdirSync(SITEMAP_DIR, { recursive: true });
  fs.writeFileSync(SITEMAP_FILE, html, 'utf8');
  console.log('Wrote', SITEMAP_FILE);
}

main();
