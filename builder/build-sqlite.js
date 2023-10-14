const fire = require('js-fire');
const fs = require('fs');
const turf = require('@turf/turf');
const Database = require('better-sqlite3');

const db = Database('./data/features.db');

function build() {
  db.prepare(`DROP TABLE IF EXISTS features`).run();

  const createStmt = db.prepare(`
    CREATE VIRTUAL TABLE features USING rtree(
      id,                   -- Integer primary key
      minX, maxX,           -- Minimum and maximum X coordinate
      minY, maxY,           -- Minimum and maximum Y coordinate
      +featureId TEXT,      -- geojson id
      +featureType TEXT,    -- type of feature, e.g. river, lake
      +geometryType TEXT,   -- type of geometry, e.g. polygon, line
      +geojson BLOB         -- geojson object
   );`);

  createStmt.run();
}

function insert(type, filename) {
  const insertStmt = db.prepare(`INSERT INTO features (id, minX, maxX, minY, maxY, featureId, featureType, geometryType, geojson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const rawGeoJSON = fs.readFileSync(filename);
  geojson = JSON.parse(rawGeoJSON);

  geojson.features.forEach(feature => {
    const bbox = turf.bbox(feature.geometry);
    const id = feature.id.split('/')[1];
    insertStmt.run(id, bbox[0], bbox[2], bbox[1], bbox[3], feature.id, type, feature.geometry.type, JSON.stringify(feature));
  });
}

build();
const geojsonFiles = fs.readdirSync('./data/geojson').filter(file => file.endsWith('.geo.json'));
geojsonFiles.forEach((file) => {
  console.log(`Building: ${file}`)
  const layerName = file.split('.')[0];
  insert(layerName, `./data/geojson/${file}`);
});
