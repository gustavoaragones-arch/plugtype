#!/usr/bin/env node
/**
 * Generate sitemap index + multiple sitemaps (50k URL limit per file).
 * Run from project root: node scripts/generate-sitemaps.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const SITEMAPS_DIR = path.join(PROJECT_ROOT, 'sitemaps');
const INDEX_PATH = path.join(PROJECT_ROOT, 'sitemap-index.xml');
const BASE = 'https://plugtype.world';
const MAX_URLS_PER_SITEMAP = 50000;

const countries = JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
const countryKeys = Object.keys(countries).sort();
const plugLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];

function writeUrlset(filePath, urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${url}</loc>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';
  fs.writeFileSync(filePath, xml, 'utf8');
}

function main() {
  if (!fs.existsSync(SITEMAPS_DIR)) {
    fs.mkdirSync(SITEMAPS_DIR, { recursive: true });
  }

  const indexEntries = [];

  // --- Core pages ---
  const coreUrls = [
    BASE + '/',
    BASE + '/about.html',
    BASE + '/contact.html',
    BASE + '/privacy.html',
    BASE + '/terms.html',
    BASE + '/compatibility/',
    BASE + '/countries/',
    BASE + '/plug-types/',
    BASE + '/sitemap/'
  ];
  const corePath = path.join(SITEMAPS_DIR, 'core-pages.xml');
  writeUrlset(corePath, coreUrls);
  indexEntries.push({ loc: BASE + '/sitemaps/core-pages.xml', count: coreUrls.length });
  console.log('Wrote sitemaps/core-pages.xml:', coreUrls.length, 'URLs');

  // --- Country hubs (compatibility/xxx/) ---
  const hubUrls = countryKeys
    .filter(k => countries[k])
    .map(k => BASE + '/compatibility/' + k + '/');
  const hubsPath = path.join(SITEMAPS_DIR, 'compatibility-hubs.xml');
  writeUrlset(hubsPath, hubUrls);
  indexEntries.push({ loc: BASE + '/sitemaps/compatibility-hubs.xml', count: hubUrls.length });
  console.log('Wrote sitemaps/compatibility-hubs.xml:', hubUrls.length, 'URLs');

  // --- Countries ---
  const countryUrls = countryKeys.map(k => BASE + '/pages/countries/' + k + '.html');
  const countriesPath = path.join(SITEMAPS_DIR, 'countries.xml');
  writeUrlset(countriesPath, countryUrls);
  indexEntries.push({ loc: BASE + '/sitemaps/countries.xml', count: countryUrls.length });
  console.log('Wrote sitemaps/countries.xml:', countryUrls.length, 'URLs');

  // --- Plug types ---
  const plugUrls = plugLetters.map(l => BASE + '/pages/plug-types/type-' + l + '.html');
  const plugPath = path.join(SITEMAPS_DIR, 'plug-types.xml');
  writeUrlset(plugPath, plugUrls);
  indexEntries.push({ loc: BASE + '/sitemaps/plug-types.xml', count: plugUrls.length });
  console.log('Wrote sitemaps/plug-types.xml:', plugUrls.length, 'URLs');

  // --- Compatibility pages (split into chunks of 50k) ---
  const compatUrls = [];
  for (const originKey of countryKeys) {
    if (!countries[originKey]) continue;
    for (const destKey of countryKeys) {
      if (originKey === destKey) continue;
      compatUrls.push(BASE + '/pages/compatibility/' + originKey + '-to-' + destKey + '.html');
    }
  }

  let chunkIndex = 1;
  for (let i = 0; i < compatUrls.length; i += MAX_URLS_PER_SITEMAP) {
    const chunk = compatUrls.slice(i, i + MAX_URLS_PER_SITEMAP);
    const name = 'compatibility-' + chunkIndex + '.xml';
    const chunkPath = path.join(SITEMAPS_DIR, name);
    writeUrlset(chunkPath, chunk);
    indexEntries.push({ loc: BASE + '/sitemaps/' + name, count: chunk.length });
    console.log('Wrote sitemaps/' + name + ':', chunk.length, 'URLs');
    chunkIndex++;
  }

  // --- Sitemap index ---
  let indexXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  indexXml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const e of indexEntries) {
    indexXml += '  <sitemap>\n';
    indexXml += '    <loc>' + e.loc + '</loc>\n';
    indexXml += '  </sitemap>\n';
  }
  indexXml += '</sitemapindex>\n';
  fs.writeFileSync(INDEX_PATH, indexXml, 'utf8');
  console.log('Wrote sitemap-index.xml with', indexEntries.length, 'sitemaps');

  const totalUrls = indexEntries.reduce((sum, e) => sum + e.count, 0);
  console.log('Total URLs across all sitemaps:', totalUrls);
  console.log('Done.');
}

main();
