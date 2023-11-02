/**
 * Fetches data from OSM and converts it to geojson
 */
import fs from 'fs';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';
import fetch from 'node-fetch';

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
const QUERY_ACCESS_POINTS = `
    area(id:3600910784)->.searchArea;
    (
    nwr[canoe=put_in][leisure=slipway](area.searchArea);
    );
    `
const QUERY_CANOE_ROUTES = `
    area(id:3600910784)->.searchArea;
    (
    nwr[route=canoe](area.searchArea);
    );
    (>;);
    `

const LAYERS = [
  {
    query: QUERY_PORTAGES,
    name: "portage"
  },
  {
    query: QUERY_RIVERS,
    name: "river"
  },
  {
    query: QUERY_CAMPSITES,
    name: "campsite"
  },
  {
    query: QUERY_LAKES,
    name: "lake"
  },
  {
    query: QUERY_ACCESS_POINTS,
    name: "access_point"
  },
  {
    query: QUERY_CANOE_ROUTES,
    name: "canoe_route",
    only: ["LineString"]
  }
]


async function request(q) {
  const query_str = `[out:json]; ${q} out geom;`
  const response = await fetch(URL, {
    method: 'POST',
    body: query_str,
  });
  return await response.json();
}

export async function fetchGeoJson(force = false) {
  // Fetch data from OSM, convert to geojson, and save to file

  for (const layer of LAYERS) {
    const osmFile = `./data/osm/${layer.name}.osm.json`;

    let osmData = null;
    // Skip if file exists
    if (force || !fs.existsSync(osmFile)) {
      console.log(`Requesting ${layer.name}...`);
      osmData = await request(layer.query);
      // Write data to file
      fs.writeFileSync(osmFile, JSON.stringify(osmData));
    } else {
      console.log(`Skipping fetching ${layer.name}...`);
    }

    // Convert osm to geojson, only if the file doesn't exist
    if (osmData || force || !fs.existsSync(`./data/geojson/${layer.name}.geo.json`)) {
      console.log(`Converting osm to geojson for ${layer.name}...`);
      const geojsonFile = `./data/geojson/${layer.name}.geo.json`;

      if (osmData == null) {
        const osmJson = fs.readFileSync(osmFile);
        osmData = JSON.parse(osmJson);
      }

      let geojson = osmtogeojson(osmData);

      // Add area and length properties
      geojson.features.forEach(feature => {
        feature.properties['featureGroup'] = layer;
        if (feature.geometry.type == 'Polygon' || feature.geometry.type == 'MultiPolygon') {
          const area = turf.area(feature.geometry);
          feature.properties['area'] = area;
        }
      });

      if (layer.only) {
        geojson.features = geojson.features.filter(feature => layer.only.includes(feature.geometry.type));
      }

      console.log(`Writing geojson for ${layer.name} with ${geojson.features.length} features`);

      fs.writeFileSync(geojsonFile, JSON.stringify(geojson));
    } else {
      console.log(`Skipping converting geojson ${layer.name}...`);
    }
  };
}
