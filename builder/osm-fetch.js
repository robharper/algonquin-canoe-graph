/**
 * Fetches data from OSM and converts it to geojson
 */
const fire = require('js-fire');
const fs = require('fs');
const osmtogeojson = require('osmtogeojson');
const turf = require('@turf/turf');

const URL = "http://overpass-api.de/api/interpreter"

const QUERY_PORTAGES = `
    area(id:3600910784)->.searchArea;
    (
    way[canoe=portage](area.searchArea);
    );
    `
const QUERY_RIVERS = `
    area(id:3600910784)->.searchArea;
    (
    way[waterway~"^(river|stream)$"](area.searchArea);
    );
    `
const QUERY_CAMPSITES = `
    area(id:3600910784)->.searchArea;
    (
    nwr[tourism=camp_site](area.searchArea);
    );
    `
const QUERY_LAKES = `
    area(id:3600910784)->.searchArea;
    (
    nwr[natural=water](area.searchArea);
    );
    `

const LAYERS = [
    {
        query: QUERY_PORTAGES,
        name: "portages"
    },
    {
        query: QUERY_RIVERS,
        name: "rivers"
    },
    {
        query: QUERY_CAMPSITES,
        name: "campsites"
    },
    {
        query: QUERY_LAKES,
        name: "lakes"
    }
]


async function request(q) {
  const query_str = `[out:json]; ${q} out geom;`
  const response = await fetch(URL, {
    data: query_str,
  });
  return await response.json();
}

async function execute(force = false) {
  // Fetch data from OSM, convert to geojson, and save to file

  await Promise.all(LAYERS.map(async (layer) => {
    const osmFile = `./data/osm/${layer.name}.osm.json`;
    let osmData;
    // Skip if file exists
    if (force || !fs.existsSync(osmFile)) {
      console.log(`Requesting ${layer.name}...`);
      osmData = await request(layer.query);
      // Write data to file
      fs.writeFileSync(osmFile, JSON.stringify(osmData));
    } else {
      const osmJson = fs.readFileSync(osmFile);
      osmData = JSON.parse(osmJson);
    }

    // Convert osm to geojson, only if the file doesn't exist
    console.log(`Converting osm to geojson for ${layer.name}...`);
    const geojsonFile = `./data/geojson/${layer.name}.geo.json`;
    const geojson = osmtogeojson(osmData);

    // Add area and length properties
    geojson.features.forEach(feature => {
      feature.properties['featureGroup'] = layer;
      if (feature.geometry.type == 'Polygon' || feature.geometry.type == 'MultiPolygon') {
        const area = turf.area(feature.geometry);
        feature.properties['area'] = area;
      } else if (feature.geometry.type == 'LineString' || feature.geometry.type == 'MultiLineString') {
        const length = turf.length(feature.geometry);
        feature.properties['length'] = length;
      }
    });

    fs.writeFileSync(geojsonFile, JSON.stringify(geojson));
  }));
}

fire(execute);
