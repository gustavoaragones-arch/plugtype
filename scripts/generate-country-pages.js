#!/usr/bin/env node
/**
 * Generate static country pages from data/countries.json.
 * Run from project root: node scripts/generate-country-pages.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const PLUG_TYPES_PATH = path.join(PROJECT_ROOT, 'data', 'plug-types.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'pages', 'countries');
const BASE_URL = 'https://plugtype.world';

function loadJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function countryKeyToSlug(key) {
  return key + '.html';
}

function renderCountryPage(countryKey, country, allKeys, countries, plugTypes) {
  const name = country.name;
  const plugTypesLine = (country.plug_types || []).join(' ');
  const voltage = country.voltage ?? '';
  const frequency = country.frequency ?? '';

  const otherKeys = allKeys.filter(k => k !== countryKey);
  const randomKeys = pickRandom(otherKeys, 5);
  const randomLinks = randomKeys
    .map(k => {
      const c = countries[k];
      return c ? `<a href="${countryKeyToSlug(k)}">${c.name}</a>` : '';
    })
    .filter(Boolean)
    .join(', ');

  const plugLinks = (country.plug_types || [])
    .map(t => `<a href="../plug-types/type-${t.toLowerCase()}.html">Type ${t}</a>`)
    .join(', ');

  const title = `Plug Type in ${name} – Power Outlets & Voltage Guide`;
  const metaDesc = `Find out what plug types are used in ${name}. See voltage, frequency, and whether you need a travel adapter.`;
  const articleJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDesc,
    about: { '@type': 'Place', name: name }
  });

  let html = fs.readFileSync(
    path.join(PROJECT_ROOT, 'templates', 'country-template.html'),
    'utf8'
  );

  const replacements = {
    '{{TITLE}}': title,
    '{{META_DESCRIPTION}}': metaDesc,
    '{{ARTICLE_JSON}}': articleJson,
    '{{COUNTRY_NAME}}': name,
    '{{PLUG_TYPES_LINE}}': plugTypesLine || '—',
    '{{VOLTAGE}}': voltage,
    '{{FREQUENCY}}': frequency,
    '{{HOME_LINK}}': '../../index.html',
    '{{CSS_PATH}}': '../../css/styles.css',
    '{{ROOT}}': '../../',
    '{{PLUG_TYPE_LINKS}}': plugLinks || '—',
    '{{RANDOM_COUNTRY_LINKS}}': randomLinks || '—'
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

function main() {
  const countries = loadJSON(COUNTRIES_PATH);
  const allKeys = Object.keys(countries);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let plugTypes = {};
  try {
    plugTypes = loadJSON(PLUG_TYPES_PATH);
  } catch (e) {
    // optional
  }

  for (const key of allKeys) {
    const country = countries[key];
    const html = renderCountryPage(key, country, allKeys, countries, plugTypes);
    const outPath = path.join(OUT_DIR, countryKeyToSlug(key));
    fs.writeFileSync(outPath, html, 'utf8');
    console.log('Wrote', outPath);
  }

  console.log('Done. Generated', allKeys.length, 'country pages.');
}

main();
