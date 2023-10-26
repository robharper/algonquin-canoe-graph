import fs from 'fs';
import * as turf from '@turf/turf';
import Database from 'better-sqlite3';

function include(feature, type, exclude) {
  // Skip features specifically marked as not canoeable
  if (feature.properties.canoe === "no") {
    return false;
  }

  const bbox = turf.bboxPolygon(turf.bbox(feature.geometry));

  // If feature entirely within an exlusion, don't include
  for (const exclusion of exclude.features) {
    if (turf.booleanWithin(bbox, exclusion)) {
      console.log(`Skipping ${feature.id} because it is within ${exclusion}`);
      return false;
    }
  }

  return true;
}

/**
 * Helper function to read a GeoJSON file and insert all features into the DB
 * @param {string} type
 * @param {string} filename
 */
function insert(db, type, filename, augmentData, exclude) {
  const insertStmt = db.prepare(`INSERT INTO features (id, minX, maxX, minY, maxY, featureId, name, featureType, geometryType, geojson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const rawGeoJSON = fs.readFileSync(filename);
  const geojson = JSON.parse(rawGeoJSON);

  geojson.features.forEach(feature => {
    if (!include(feature, type, exclude)) {
      return;
    }
    const additionalData = augmentData[feature.id];
    if (additionalData) {
      feature.properties = {...feature.properties, ...additionalData.properties};
      console.log(`Augmented ${feature.id}`)
    }
    const id = feature.id.split('/')[1];
    const name = feature.properties.name;
    const bbox = turf.bbox(feature.geometry);
    insertStmt.run(id, bbox[0], bbox[2], bbox[1], bbox[3], feature.id, name, type, feature.geometry.type, JSON.stringify(feature));
  });
}

/**
 * Populates the DB with all geojson data
 */
export function buildDB() {
  const db = Database('./data/features.db');

  // Start over
  db.prepare(`DROP TABLE IF EXISTS features`).run();

  const createStmt = db.prepare(`
    CREATE VIRTUAL TABLE features USING rtree(
      id,                   -- Integer primary key
      minX, maxX,           -- Minimum and maximum X coordinate
      minY, maxY,           -- Minimum and maximum Y coordinate
      +featureId TEXT,      -- geojson id
      +name TEXT,           -- geojson feature name
      +featureType TEXT,    -- type of feature, e.g. river, lake
      +geometryType TEXT,   -- type of geometry, e.g. polygon, line
      +geojson BLOB         -- geojson object
   );`);

  createStmt.run();

  // Fetch augmentation data
  const augment = JSON.parse(fs.readFileSync('./data/enrichments/additional_data.json'));
  const exclude = JSON.parse(fs.readFileSync('./data/enrichments/exclusions.json'));

  // Add all data
  const geojsonFiles = fs.readdirSync('./data/geojson').filter(file => file.endsWith('.geo.json'));
  geojsonFiles.forEach((file) => {
    console.log(`Building: ${file}`)
    const layerName = file.split('.')[0];

    // Skip campsites in graph building
    if (layerName === 'campsite') {
      return;
    }

    insert(db, layerName, `./data/geojson/${file}`, augment, exclude);
  });
}

