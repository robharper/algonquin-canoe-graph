import * as turf from '@turf/turf';
import { distanceToPolygon } from './turf.distanceToPolygon.js';
import { distanceBetweenLines } from './turf.distanceBetweenLines.js';

function getExactIntersecton(geoJsonA, geoJsonB) {
  if (geoJsonA.geometry.type === 'Point' && geoJsonB.geometry.type === 'Point') {
    // We never intersect points to points, so ignore this case
    return;
  } else if (geoJsonA.geometry.type === 'Point' || geoJsonB.geometry.type === 'Point') {
    // Test point against polygon / line
    const pt = geoJsonA.geometry.type === 'Point' ? geoJsonA : geoJsonB;
    const other = geoJsonA.geometry.type === 'Point' ? geoJsonB : geoJsonA;
    if (other.geometry.type === 'LineString') {
      return turf.booleanPointOnLine(pt, other) ? pt.geometry.coordinates : null;
    } else {
      return turf.booleanPointInPolygon(pt, other) ? pt.geometry.coordinates : null;
    }
  } else {
    // Exact
    const intersections = turf.lineIntersect(geoJsonA.geometry, geoJsonB.geometry);
    if (intersections.features.length > 0) {
      return intersections.features[0].geometry.coordinates;
    }
  }
}

function getClose(geoJsonA, geoJsonB, maxDistanceKm=0.01) {
  // First, if they actually intersect, they're overlapping and less than maxDistanceKm apart
  const exactIntersection = getExactIntersecton(geoJsonA, geoJsonB);
  if (exactIntersection) {
    return exactIntersection;
  }

  // Three cases:
  // 1. Polygon to polygon - use exact intersection. In our use case we're more concerned with
  //    line to line/polygon proximity as we assume lakes are either connected directly or not at all
  // 2. Polygon to line - test the two ends of the line for closeness to polygon
  // 3. Line to line - test the two ends of the line for closeness to line
  const points = [geoJsonA, geoJsonB].filter(g => g.geometry.type === 'Point');
  const lines = [geoJsonA, geoJsonB].filter(g => g.geometry.type === 'LineString');
  const polygons = [geoJsonA, geoJsonB].filter(g => g.geometry.type === 'Polygon' || g.geometry.type === 'MultiPolygon');

  if (points.length === 2) {
    // Two points, we don't care about this case
    return;
  } else if (points.length === 1 && lines.length === 1) {
    const dist = turf.pointToLineDistance(points[0], lines[0]);
    if (dist < maxDistanceKm) {
      return points[0].geometry.coordinates;
    }
  } else if (points.length === 1 && polygons.length === 1) {
    const dist = distanceToPolygon({point: points[0], polygon: polygons[0]});
    if (dist < maxDistanceKm) {
      return points[0].geometry.coordinates;
    }
  } else if (polygons.length === 2) {
    return getExactIntersecton(geoJsonA, geoJsonB);
  } else if (polygons.length === 1 && lines.length === 1) {
    // Polygon to line proximity
    const polygon = polygons[0];
    const line = lines[0];

    const start = line.geometry.coordinates[0];
    const end = line.geometry.coordinates[line.geometry.coordinates.length - 1];

    const startDist = distanceToPolygon({point: start, polygon: polygon});
    const endDist = distanceToPolygon({point: end, polygon: polygon});
    if (startDist < maxDistanceKm && startDist < endDist) {
      return start;
    } else if (endDist < maxDistanceKm) {
      return end;
    }
  } else if (lines.length === 2) {
    // Two lines
    const [dist, pt] = distanceBetweenLines(lines[0], lines[1]);
    if (dist < maxDistanceKm) {
      return pt;
    }
  }
}

export function findIntersections(db, feature, exact=true) {
  const featureGeoJSON = JSON.parse(feature.geojson);

  // Find all intersecting geometries - add a 10m buffer (0.000125 degrees is about 10m at 45 lat)
  const queryStmt = db.prepare(
    `SELECT f.* FROM features AS f, features AS TARGET
      WHERE f.maxX>=(TARGET.minX - 0.000125) AND f.minX<=(TARGET.maxX + 0.000125)
        AND f.maxY>=(TARGET.minY - 0.000125) AND f.minY<=(TARGET.maxY + 0.000125)
        AND TARGET.id=?;`);

  const possibleIntersections = queryStmt.all(feature.id);

  let intersectingFeatures = possibleIntersections.map((overlap) => {
    console.log(`Checking ${overlap.id}`);

    if (feature.id === overlap.id) {
      return null;
    }
    const overlapGeoJSON = JSON.parse(overlap.geojson);

    let intersection = null;
    if (exact) {
      intersection = getExactIntersecton(featureGeoJSON, overlapGeoJSON);
    } else {
      intersection = getClose(featureGeoJSON, overlapGeoJSON);
    }

    if (intersection) {
      return {
        feature: overlap,
        intersection,
      };
    } else {
      return null;
    }
  }).filter(f => f != null);

  return intersectingFeatures;
}
