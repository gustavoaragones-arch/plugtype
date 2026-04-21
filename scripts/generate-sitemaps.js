#!/usr/bin/env node
/**
 * Generate crawl-priority sitemaps under /public/sitemaps (served at /sitemaps/* on Vercel and most static hosts).
 * Run from project root: node scripts/generate-sitemaps.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
/** Served at https://plugtype.world/sitemaps/… (Vercel maps public/ to site root) */
const PUBLIC_SITEMAPS_DIR = path.join(PROJECT_ROOT, 'public', 'sitemaps');
const ROOT_INDEX_COMPAT_PATH = path.join(PROJECT_ROOT, 'sitemap-index.xml');
const BASE = 'https://plugtype.world';
const MAX_URLS_PER_SITEMAP = 50000;

const countries = JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
const countryKeys = Object.keys(countries).sort();
const plugLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];

function writeUrlset(filePath, entries) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${entry.loc}</loc>\n`;
    if (entry.priority != null) {
      xml += `    <priority>${entry.priority}</priority>\n`;
    }
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';
  fs.writeFileSync(filePath, xml, 'utf8');
}

function main() {
  if (!fs.existsSync(PUBLIC_SITEMAPS_DIR)) {
    fs.mkdirSync(PUBLIC_SITEMAPS_DIR, { recursive: true });
  }

  const indexEntries = [];

  // --- Countries sitemap (includes homepage + static + country-related URLs) ---
  const countryEntries = [];
  countryEntries.push({ loc: BASE + '/', priority: '1.0' }); // homepage boost
  countryEntries.push({ loc: BASE + '/about.html', priority: '0.7' });
  countryEntries.push({ loc: BASE + '/contact.html', priority: '0.7' });
  countryEntries.push({ loc: BASE + '/privacy.html', priority: '0.4' });
  countryEntries.push({ loc: BASE + '/terms.html', priority: '0.4' });
  countryEntries.push({ loc: BASE + '/compatibility/', priority: '0.8' });
  countryEntries.push({ loc: BASE + '/countries/', priority: '0.8' });
  countryEntries.push({ loc: BASE + '/plug-types/', priority: '0.7' });
  countryEntries.push({ loc: BASE + '/sitemap/index.html', priority: '0.6' });
  countryEntries.push({ loc: BASE + '/why-plug-types-differ/', priority: '0.7' });
  countryEntries.push({ loc: BASE + '/adapter-vs-converter/', priority: '0.7' });

  for (const key of countryKeys) {
    if (!countries[key]) continue;
    countryEntries.push({ loc: BASE + '/compatibility/' + key + '/', priority: '0.8' });
  }

  for (const key of countryKeys) {
    if (!countries[key]) continue;
    countryEntries.push({ loc: BASE + '/pages/countries/' + key + '.html', priority: '0.8' });
  }

  for (const letter of plugLetters) {
    countryEntries.push({ loc: BASE + '/pages/plug-types/type-' + letter + '.html', priority: '0.7' });
  }

  const countriesPath = path.join(PUBLIC_SITEMAPS_DIR, 'sitemap-countries.xml');
  writeUrlset(countriesPath, countryEntries);
  indexEntries.push({ loc: BASE + '/sitemaps/sitemap-countries.xml', count: countryEntries.length });
  console.log('Wrote public/sitemaps/sitemap-countries.xml:', countryEntries.length, 'URLs');

  // --- Compatibility pages (split into chunks of 50k) ---
  const compatUrls = [];
  for (const originKey of countryKeys) {
    if (!countries[originKey]) continue;
    for (const destKey of countryKeys) {
      if (originKey === destKey) continue;
      compatUrls.push(BASE + '/pages/compatibility/' + originKey + '-to-' + destKey + '.html');
    }
  }

  const compatEntries = compatUrls.map(loc => ({ loc, priority: '0.6' }));
  const compatChunk1 = compatEntries.slice(0, MAX_URLS_PER_SITEMAP);
  const compatChunk2 = compatEntries.slice(MAX_URLS_PER_SITEMAP, MAX_URLS_PER_SITEMAP * 2);

  const compat1Path = path.join(PUBLIC_SITEMAPS_DIR, 'sitemap-compatibility-1.xml');
  const compat2Path = path.join(PUBLIC_SITEMAPS_DIR, 'sitemap-compatibility-2.xml');
  writeUrlset(compat1Path, compatChunk1);
  writeUrlset(compat2Path, compatChunk2);
  indexEntries.push({ loc: BASE + '/sitemaps/sitemap-compatibility-1.xml', count: compatChunk1.length });
  indexEntries.push({ loc: BASE + '/sitemaps/sitemap-compatibility-2.xml', count: compatChunk2.length });
  console.log('Wrote public/sitemaps/sitemap-compatibility-1.xml:', compatChunk1.length, 'URLs');
  console.log('Wrote public/sitemaps/sitemap-compatibility-2.xml:', compatChunk2.length, 'URLs');

  // --- Sitemap index ---
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <sitemap>
    <loc>https://plugtype.world/sitemaps/sitemap-countries.xml</loc>
  </sitemap>

  <sitemap>
    <loc>https://plugtype.world/sitemaps/sitemap-compatibility-1.xml</loc>
  </sitemap>

  <sitemap>
    <loc>https://plugtype.world/sitemaps/sitemap-compatibility-2.xml</loc>
  </sitemap>

</sitemapindex>
`;
  fs.writeFileSync(path.join(PUBLIC_SITEMAPS_DIR, 'sitemap-index.xml'), sitemapIndex, 'utf8');
  fs.writeFileSync(ROOT_INDEX_COMPAT_PATH, sitemapIndex, 'utf8');
  console.log('Wrote public/sitemaps/sitemap-index.xml');

  const totalUrls = indexEntries.reduce((sum, e) => sum + e.count, 0);
  console.log('Total URLs across all sitemaps:', totalUrls);
  console.log('Done.');
}

main();
