#!/usr/bin/env node
/**
 * Build lightweight /images/world-map.svg from Natural Earth 110m + countries.json slugs.
 * Run: node scripts/build-world-map-svg.js
 */

const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const d3 = require('d3-geo');
const world = require('world-atlas/countries-110m.json');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COUNTRIES_PATH = path.join(PROJECT_ROOT, 'data', 'countries.json');
const OUT_PATH = path.join(PROJECT_ROOT, 'images', 'world-map.svg');

/** Natural Earth short names → countries.json keys */
const NE_NAME_ALIASES = {
  'w. sahara': 'western-sahara',
  'united states of america': 'united-states',
  'dem. rep. congo': 'congo-kinshasa',
  'dominican rep.': 'dominican-republic',
  'falkland is.': 'falkland-islands',
  "côte d'ivoire": 'ivory-coast',
  'central african rep.': 'central-african-republic',
  congo: 'congo-brazzaville',
  'eq. guinea': 'equatorial-guinea',
  'solomon is.': 'solomon-islands',
  czechia: 'czech-republic',
  'n. cyprus': 'northern-cyprus',
  'bosnia and herz.': 'bosnia-and-herzegovina',
  macedonia: 'north-macedonia',
  's. sudan': 'south-sudan'
};

function main() {
  const countries = JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
  const nameToKey = {};
  for (const [key, c] of Object.entries(countries)) {
    nameToKey[c.name.toLowerCase().trim()] = key;
  }

  const geo = topojson.feature(world, world.objects.countries);
  const width = 1000;
  const height = 520;
  const projection = d3.geoNaturalEarth1().fitSize([width, height], geo);
  const pathGen = d3.geoPath(projection);

  const paths = [];
  for (const feature of geo.features) {
    const neName = (feature.properties && feature.properties.name) || '';
    const lower = neName.toLowerCase().trim();
    let slug = NE_NAME_ALIASES[lower] || nameToKey[lower];
    if (!slug || !countries[slug]) continue;
    const d = pathGen(feature);
    if (!d) continue;
    paths.push(`<path id="${slug}" d="${escapeAttr(d)}"/>`);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="World map — hover countries for plug types">
${paths.join('\n')}
</svg>
`;
  fs.writeFileSync(OUT_PATH, svg, 'utf8');
  console.log('Wrote', OUT_PATH, 'paths:', paths.length, 'bytes:', fs.statSync(OUT_PATH).size);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

main();
