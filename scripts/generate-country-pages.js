#!/usr/bin/env node
/**
 * Generate static country pages (plugs, voltage, high-intent route hubs).
 * Output: countries/{country-key}.html
 * URL policy (Option A): canonical = /countries/{slug} (no .html, served by CF Pages 308 strip).
 * Run from project root: node scripts/generate-country-pages.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'templates', 'country-page-template.html');
const OUT_DIR = path.join(PROJECT_ROOT, 'countries');
const BASE = 'https://plugtype.world';
const BUILD_DATE = new Date().toISOString().split('T')[0];

/** High-intent destinations always linked first (when not the page’s own country). */
const PRIORITY_INTEL_DESTINATIONS = [
  'united-states',
  'united-kingdom',
  'canada',
  'australia',
  'germany',
  'france',
  'spain',
  'italy',
  'japan',
  'thailand',
  'brazil',
  'mexico'
];
const TOP_DESTINATIONS = ['united-states', 'united-kingdom', 'canada', 'australia', 'japan'];

/** Total popular-route links (12–20). */
const TARGET_ROUTE_COUNT = 18;

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function deterministicVariantIndex(originKey, destKey, modulo) {
  const s = originKey + '\x1e' + destKey;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

function formatPlugTypesInline(types) {
  if (!types || types.length === 0) return '—';
  const t = types.map(x => escapeHtml(String(x).trim()));
  if (t.length === 1) return t[0];
  if (t.length === 2) return t[0] + ' and ' + t[1];
  return t.slice(0, -1).join(', ') + ', and ' + t[t.length - 1];
}

function formatPlugTypesSpaced(types) {
  if (!types || types.length === 0) return '—';
  return types.map(x => escapeHtml(String(x).trim())).join(' ');
}

function buildPopularRouteDestinations(countryKey, allKeys, countries) {
  const chosen = [];
  const seen = new Set([countryKey]);

  for (const d of PRIORITY_INTEL_DESTINATIONS) {
    if (seen.has(d)) continue;
    if (!countries[d]) continue;
    chosen.push(d);
    seen.add(d);
  }

  const rest = allKeys
    .filter(k => !seen.has(k) && countries[k])
    .map(k => ({
      k,
      v: deterministicVariantIndex(countryKey + ':popular', k, 1000007)
    }))
    .sort((a, b) => a.v - b.v || a.k.localeCompare(b.k));

  for (const { k } of rest) {
    if (chosen.length >= TARGET_ROUTE_COUNT) break;
    chosen.push(k);
    seen.add(k);
  }

  if (chosen.length < 12) {
    for (const k of allKeys) {
      if (chosen.length >= 12) break;
      if (seen.has(k) || !countries[k]) continue;
      chosen.push(k);
      seen.add(k);
    }
  }

  return chosen;
}

function buildPopularRoutesList(countryKey, country, countries, destKeys) {
  const fromName = escapeHtml(country.name);
  return destKeys
    .map(d => {
      const toName = escapeHtml(countries[d].name);
      const href = `/compatibility/${countryKey}-to-${d}`;
      const anchor = `${fromName} → ${toName} plug adapter`;
      return `      <li><a href="${href}">${anchor}</a></li>`;
    })
    .join('\n');
}

function buildTopRoutesList(countryKey, country, countries) {
  const fromName = escapeHtml(country.name);
  return TOP_DESTINATIONS.filter(dest => dest !== countryKey && countries[dest])
    .map(dest => {
      const toName = escapeHtml(countries[dest].name);
      return `      <li><a href="/compatibility/${countryKey}-to-${dest}">${fromName} → ${toName} plug adapter</a></li>`;
    })
    .join('\n');
}

function buildIntro(country, plugTypesInline, voltageDisplay, frequencyDisplay) {
  const name = escapeHtml(country.name);
  return (
    `In ${name}, power plugs and sockets are of type ${plugTypesInline}. ` +
    `The standard voltage is ${voltageDisplay} and the frequency is ${frequencyDisplay}.`
  );
}

function buildPage(countryKey, countries, allKeys) {
  const country = countries[countryKey];
  if (!country) return null;

  const displayName = country.name || countryKey;
  const plugTypesInline = formatPlugTypesInline(country.plug_types || []);
  const plugTypesSpaced = formatPlugTypesSpaced(country.plug_types || []);
  const plugTypeWord = (country.plug_types || []).length > 1 ? 'types' : 'type';

  const voltageNumeric =
    country.voltage != null && country.voltage !== ''
      ? escapeHtml(String(country.voltage))
      : '—';
  const frequencyNumeric =
    country.frequency != null && country.frequency !== ''
      ? escapeHtml(String(country.frequency))
      : '—';

  const voltageDisplay =
    country.voltage != null && country.voltage !== ''
      ? voltageNumeric + 'V'
      : '—';
  const frequencyDisplay =
    country.frequency != null && country.frequency !== ''
      ? frequencyNumeric + 'Hz'
      : '—';

  const voltageSemantic =
    country.voltage != null && country.voltage !== ''
      ? escapeHtml(String(country.voltage)) + 'V'
      : 'an electricity supply where nominal voltage can vary—check locally';

  const voltageFaq =
    country.voltage != null && country.voltage !== ''
      ? escapeHtml(String(country.voltage)) + 'V'
      : '— (confirm for your location)';

  const h1 = `Power Plugs and Voltage in ${escapeHtml(displayName)}`;
  const title = `Power Plugs in ${displayName} – Type, Voltage & Travel Adapter Guide`;
  const metaDesc = `Find out which plug types, voltage, and frequency are used in ${displayName}. Check if you need a travel adapter or voltage converter.`;
  const canonical = `${BASE}/countries/${countryKey}`;

  const intro = buildIntro(country, plugTypesInline, voltageDisplay, frequencyDisplay);

  const breadcrumb =
    '<a href="/">Home</a> \u2192 <a href="/countries/">Countries</a> \u2192 ' +
    escapeHtml(displayName);

  const ldJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Countries', item: BASE + '/countries/' },
          { '@type': 'ListItem', position: 3, name: displayName, item: canonical }
        ]
      },
      {
        '@type': 'Place',
        name: displayName,
        description: metaDesc,
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'Plug types', value: (country.plug_types || []).join(', ') },
          { '@type': 'PropertyValue', name: 'Voltage', value: voltageDisplay },
          { '@type': 'PropertyValue', name: 'Frequency', value: frequencyDisplay }
        ]
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What plug type is used in ' + displayName + '?',
            acceptedAnswer: { '@type': 'Answer', text: displayName + ' uses plug type(s) ' + plugTypesInline + '.' }
          },
          {
            '@type': 'Question',
            name: 'What voltage is used in ' + displayName + '?',
            acceptedAnswer: { '@type': 'Answer', text: 'The standard voltage in ' + displayName + ' is ' + voltageDisplay + ' at ' + frequencyDisplay + '.' }
          },
          {
            '@type': 'Question',
            name: 'Do I need a travel adapter for ' + displayName + '?',
            acceptedAnswer: { '@type': 'Answer', text: 'Whether you need a travel adapter depends on your country of origin. ' + displayName + ' uses plug type(s) ' + plugTypesInline + '. If your home country uses different plug types, a travel adapter is required.' }
          }
        ]
      }
    ]
  }).replace(/</g, '\\u003c');

  const routeDests = buildPopularRouteDestinations(countryKey, allKeys, countries);
  const popularRoutes = buildPopularRoutesList(countryKey, country, countries, routeDests);
  const topRoutes = buildTopRoutesList(countryKey, country, countries);
  const escapedDisplay = escapeHtml(displayName);

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const replacements = {
    '{{TITLE}}': escapeHtml(title),
    '{{META_DESCRIPTION}}': escapeHtml(metaDesc),
    '{{CANONICAL}}': canonical,
    '{{H1}}': h1,
    '{{INTRO}}': intro,
    '{{BREADCRUMB}}': breadcrumb,
    '{{COUNTRY_NAME}}': escapedDisplay,
    '{{PLUG_TYPES_INLINE}}': plugTypesInline,
    '{{PLUG_TYPES_SPACED}}': plugTypesSpaced,
    '{{PLUG_TYPE_WORD}}': plugTypeWord,
    '{{VOLTAGE}}': voltageNumeric,
    '{{FREQUENCY}}': frequencyNumeric,
    '{{VOLTAGE_DISPLAY}}': voltageDisplay,
    '{{FREQUENCY_DISPLAY}}': frequencyDisplay,
    '{{VOLTAGE_SEMANTIC}}': voltageSemantic,
    '{{VOLTAGE_FAQ}}': voltageFaq,
    '{{BUILD_DATE}}': BUILD_DATE,
    '{{TOP_ROUTES}}': topRoutes,
    '{{POPULAR_ROUTES}}': popularRoutes,
    '{{LD_JSON}}': ldJson,
    '{{OG_TITLE}}': escapeHtml(title),
    '{{OG_DESCRIPTION}}': escapeHtml(metaDesc),
    '{{OG_URL}}': canonical,
    '{{OG_IMAGE}}': BASE + '/images/og-default.png'
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }
  return html;
}

function main() {
  const countries = loadJSON(COUNTRIES_PATH);
  const allKeys = Object.keys(countries).sort((a, b) =>
    (countries[a].name || '').localeCompare(countries[b].name || '')
  );

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let count = 0;
  for (const countryKey of allKeys) {
    if (!countries[countryKey]) continue;
    const html = buildPage(countryKey, countries, allKeys);
    if (!html) continue;
    const outPath = path.join(OUT_DIR, `${countryKey}.html`);
    fs.writeFileSync(outPath, html, 'utf8');
    count++;
  }

  console.log('Done. Generated', count, 'country pages in', OUT_DIR);

  writeCountryHub(countries, allKeys);
}

function writeCountryHub(countries, allKeys) {
  const hubCanonical = BASE + '/countries/';

  // Group by first letter of display name
  const byLetter = {};
  for (const key of allKeys) {
    const c = countries[key];
    if (!c) continue;
    const letter = (c.name || key)[0].toUpperCase();
    if (!byLetter[letter]) byLetter[letter] = [];
    byLetter[letter].push({ key, name: c.name || key });
  }
  const letters = Object.keys(byLetter).sort();

  const letterSections = letters.map(letter => {
    const items = byLetter[letter]
      .map(({ key, name }) => `      <li><a href="/countries/${key}">${escapeHtml(name)}</a></li>`)
      .join('\n');
    return `    <h2>${letter}</h2>\n    <ul>\n${items}\n    </ul>`;
  }).join('\n\n');

  const hubLdJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Countries', item: hubCanonical }
        ]
      },
      {
        '@type': 'CollectionPage',
        name: 'Power Plugs by Country',
        description: 'Browse plug types, voltage, and frequency for every country in the world. Find out if you need a travel adapter for your destination.',
        url: hubCanonical
      }
    ]
  }).replace(/</g, '\\u003c');

  const hubTitle = 'Power Plugs by Country – Worldwide Plug Type &amp; Voltage Guide | Plug Type World';
  const hubDesc = 'Browse plug types, voltage, and frequency for every country in the world. Find out if you need a travel adapter for your destination.';
  const hubOgTitle = 'Power Plugs by Country – Worldwide Plug Type & Voltage Guide | Plug Type World';

  const hubHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hubTitle}</title>
  <meta name="description" content="${escapeHtml(hubDesc)}">
  <link rel="canonical" href="${hubCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(hubOgTitle)}">
  <meta property="og:description" content="${escapeHtml(hubDesc)}">
  <meta property="og:url" content="${hubCanonical}">
  <meta property="og:image" content="${BASE}/images/og-default.png">
  <meta property="og:site_name" content="Plug Type World">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(hubOgTitle)}">
  <meta name="twitter:description" content="${escapeHtml(hubDesc)}">
  <meta name="twitter:image" content="${BASE}/images/og-default.png">
  <script type="application/ld+json">${hubLdJson}</script>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="hero">
    <h1>Power Plugs by Country</h1>
    <p class="intro">Browse plug types, voltage, and frequency for every country in the world. Use the guide below to find out if you need a travel adapter for your destination.</p>
    <p class="tagline"><a href="/">← Compatibility tool</a></p>
  </header>

  <main class="hub-main">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> → Countries</nav>

    <section class="country-hub-list">
${letterSections}
    </section>

    <section class="cta-section">
      <h2>Check any country pair</h2>
      <p><a href="/" class="cta-button">Use the compatibility tool</a></p>
    </section>
  </main>

  <footer>
    <p><a href="/about.html">About</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/sitemap/index.html">HTML Sitemap</a></p>
    <p>Plug Type World is a product of Albor Digital LLC.</p>
  </footer>
</body>
</html>
`;

  const hubPath = path.join(OUT_DIR, 'index.html');
  fs.writeFileSync(hubPath, hubHtml, 'utf8');
  console.log('Written countries/index.html');
}

main();
