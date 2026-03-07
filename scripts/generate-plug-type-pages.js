#!/usr/bin/env node
/**
 * Generate static plug type pages (type-a.html through type-o.html).
 * Run from project root: node scripts/generate-plug-type-pages.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const PLUG_TYPES_PATH = path.join(PROJECT_ROOT, 'data', 'plug-types.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'pages', 'plug-types');

const plugLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getCountriesByPlugType(countries) {
  const byType = {};
  for (const letter of plugLetters) {
    byType[letter] = [];
  }
  const keys = Object.keys(countries).sort((a, b) =>
    countries[a].name.localeCompare(countries[b].name)
  );
  for (const key of keys) {
    const c = countries[key];
    for (const t of c.plug_types || []) {
      if (byType[t]) {
        byType[t].push({ key, name: c.name });
      }
    }
  }
  return byType;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main() {
  const countries = loadJSON(COUNTRIES_PATH);
  const plugTypes = loadJSON(PLUG_TYPES_PATH);
  const byType = getCountriesByPlugType(countries);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const letter of plugLetters) {
    const info = plugTypes[letter] || { name: `Type ${letter}`, description: '', regions: '' };
    const list = byType[letter] || [];
    const countryLinks = list
      .slice(0, 80)
      .map(c => `<a href="../countries/${c.key}.html">${escapeHtml(c.name)}</a>`)
      .join(', ');
    const more = list.length > 80 ? ` and ${list.length - 80} more.` : '.';

    const title = `${info.name} Plug – Countries & Compatibility`;
    const metaDesc = `${info.name}: ${info.description}. Used in ${info.regions}. See which countries use it.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <link rel="stylesheet" href="../../css/styles.css">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDesc
  })}</script>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(info.name)} Plug – Countries &amp; Compatibility</h1>
    <p class="tagline"><a href="../../index.html">← Compatibility tool</a></p>
  </header>

  <main>
    <section class="country-details">
      <h2>Plug shape &amp; regions</h2>
      <p>${escapeHtml(info.description)}</p>
      <p><strong>Typical regions:</strong> ${escapeHtml(info.regions || '—')}</p>
    </section>

    <section class="plug-links">
      <h2>Countries using Type ${letter}</h2>
      <p>${countryLinks || '—'}${more}</p>
    </section>

    <section class="cta-section">
      <h2>Check compatibility</h2>
      <p><a href="../../index.html" class="cta-button">Use the compatibility tool</a></p>
    </section>

    <section class="faq-section">
      <h2>FAQ</h2>
      <dl>
        <dt>Do I need an adapter for Type ${letter}?</dt>
        <dd>Use our <a href="../../index.html">compatibility tool</a> with your country and destination to see if you need an adapter.</dd>
      </dl>
    </section>
  </main>

  <footer>
    <p><a href="../../about.html">About</a> · <a href="../../contact.html">Contact</a> · <a href="../../privacy.html">Privacy</a> · <a href="../../terms.html">Terms</a></p>
    <p>Plug Type World is a product of Albor Digital LLC.</p>
  </footer>
</body>
</html>
`;

    const outPath = path.join(OUT_DIR, `type-${letter.toLowerCase()}.html`);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log('Wrote', outPath);
  }

  console.log('Done. Generated 15 plug type pages.');
}

main();
