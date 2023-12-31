import fire from 'js-fire';
import { fetchGeoJson } from './tasks/osm-fetch.js';
import { buildTiles } from './tasks/geojson-to-mbtiles.js';
import { buildDB } from './tasks/build-db.js';
import { prepareDB } from './tasks/prepare-db.js';
import { buildGraph, cleanGraph } from './tasks/build-graph.js';

fire({
  __description__: 'Algonquin Park Map Builder',
  fetchGeoJson,
  buildTiles,
  buildDB,
  prepareDB,
  buildGraph,
  cleanGraph,
})