import { bbox, length } from '@turf/turf';
import { INSERT_STMT } from './queries.js';

export function insertFeature(db, geojson, featureType, id=null) {
  const insertStmt = db.prepare(INSERT_STMT);

  const dbId = id ?? geojson.id.split('/')[1];

  const box = bbox(geojson);
  geojson.properties['length'] = length(geojson.geometry);
  insertStmt.run(dbId, box[0], box[2], box[1], box[3], geojson.id,
    geojson.name, featureType, geojson.geometry.type, JSON.stringify(geojson));
}