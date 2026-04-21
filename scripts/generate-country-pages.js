#!/usr/bin/env node
/**
 * Generate static country pages (plugs, voltage, high-intent route hubs).
 * Output: pages/countries/{country-key}.html
 * URL policy (Option A): canonical and internal links use /pages/countries/ only.
 * Run from project root: node scripts/generate-country-pages.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'templates', 'country-page-template.html');
const OUT_DIR = path.join(PROJECT_ROOT, 'pages', 'countries');
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
      const href = `../compatibility/${countryKey}-to-${d}.html`;
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
      return `      <li><a href="../compatibility/${countryKey}-to-${dest}.html">${fromName} → ${toName} plug adapter</a></li>`;
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
  const canonical = `${BASE}/pages/countries/${countryKey}.html`;

  const intro = buildIntro(country, plugTypesInline, voltageDisplay, frequencyDisplay);

  const breadcrumb =
    '<a href="../../index.html">Home</a> \u2192 <a href="index.html">Countries</a> \u2192 ' +
    escapeHtml(displayName);

  const articleJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDesc,
    about: { '@type': 'Place', name: displayName }
  });

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
    '{{ARTICLE_JSON}}': articleJson
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
}

main();
