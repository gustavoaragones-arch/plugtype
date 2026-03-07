#!/usr/bin/env node
/**
 * Generate sitemap.xml from countries and plug types.
 * Run from project root: node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const SITEMAP_PATH = path.join(PROJECT_ROOT, 'sitemap.xml');
const BASE = 'https://plugtype.world';

const countries = JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
const countryKeys = Object.keys(countries).sort();
const plugLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];

const COMPAT_ORIGIN_KEYS = [
  'united-states', 'canada', 'united-kingdom', 'australia', 'germany', 'france', 'spain', 'italy',
  'brazil', 'japan', 'india', 'netherlands', 'sweden', 'switzerland', 'singapore', 'south-korea',
  'mexico', 'thailand', 'philippines', 'south-africa'
];

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

xml += '  <url>\n';
xml += `    <loc>${BASE}/</loc>\n`;
xml += '  </url>\n';
xml += '  <url>\n';
xml += `    <loc>${BASE}/about.html</loc>\n`;
xml += '  </url>\n';
xml += '  <url>\n';
xml += `    <loc>${BASE}/contact.html</loc>\n`;
xml += '  </url>\n';
xml += '  <url>\n';
xml += `    <loc>${BASE}/privacy.html</loc>\n`;
xml += '  </url>\n';
xml += '  <url>\n';
xml += `    <loc>${BASE}/terms.html</loc>\n`;
xml += '  </url>\n';

for (const key of countryKeys) {
  xml += '  <url>\n';
  xml += `    <loc>${BASE}/pages/countries/${key}.html</loc>\n`;
  xml += '  </url>\n';
}

for (const letter of plugLetters) {
  xml += '  <url>\n';
  xml += `    <loc>${BASE}/pages/plug-types/type-${letter}.html</loc>\n`;
  xml += '  </url>\n';
}

let compatCount = 0;
for (const originKey of COMPAT_ORIGIN_KEYS) {
  if (!countries[originKey]) continue;
  for (const destKey of countryKeys) {
    if (originKey === destKey) continue;
    xml += '  <url>\n';
    xml += `    <loc>${BASE}/pages/compatibility/${originKey}-to-${destKey}.html</loc>\n`;
    xml += '  </url>\n';
    compatCount++;
  }
}

xml += '</urlset>\n';

fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
const total = 1 + 4 + countryKeys.length + plugLetters.length + compatCount;
console.log('Wrote sitemap.xml with', total, 'URLs.');
console.log('  Homepage: 1');
console.log('  Entity pages: 4 (about, contact, privacy, terms)');
console.log('  Country pages:', countryKeys.length);
console.log('  Plug type pages:', plugLetters.length);
console.log('  Compatibility pages:', compatCount);
console.log('Done.');