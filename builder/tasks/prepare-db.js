import Database from 'better-sqlite3';
import { booleanEqual, point, length } from '@turf/turf';
import { findIntersections } from './geo/intersection.js';
import { lineMultiSplit } from './geo/split.js';
import { insertFeature } from './lib/db-queries.js';
import { ALL_OF_TYPE, DB_FIND_OVERLAPS_BY_TYPE, UPDATE_GEOJSON } from './lib/queries.js';
import { endpoints } from './geo/endpoints.js';

/**
 * No longer used
 */
function namePortages(db) {
  const allPortages = db.prepare(ALL_OF_TYPE);
  const updatePortage = db.prepare(`UPDATE features SET name=? WHERE id=?`);

  for (const portage of allPortages.all('portage')) {
    if (portage.name) {
      continue;
    }

    const intersections = findIntersections(db, portage, false);
    if (intersections.length > 0) {
      const intersectingNames = Array.from(new Set(intersections.map(f => f.feature.featureType === 'portage' ? null : f.feature.name).filter(f => f)));
      if (intersectingNames.length > 0) {
        const newName = intersectingNames.join(' - ') + ' Portage';
        updatePortage.run(newName, portage.id);
        console.log(`--Setting ${newName}`);
      }
    } else {
      console.log(`Portage ${portage.id} does not intersect with any features`);
    }
  }
}

/**
 * Iterates over all routes and divides them at intersections such
 * that a given canoe route segement is only connected at its endpoints
 * @param {*} db
 */
function divideRouteIntersections(db) {
  const allRoutesQuery = db.prepare(ALL_OF_TYPE);
  const overlapQuery = db.prepare(DB_FIND_OVERLAPS_BY_TYPE);
  const deleteStmt = db.prepare(`DELETE FROM features WHERE id=?`);

  for (const route of allRoutesQuery.all('canoe_route')) {
    const routeGeoJSON = JSON.parse(route.geojson);
    if (routeGeoJSON.geometry.type !== 'LineString') {
      console.error(`Route ${route.id} is not a line`);
      continue;
    }

    const possibleIntersections = overlapQuery.all("canoe_route", route.id);
    const intersections = findIntersections(route, possibleIntersections, true);

    // Check that all intersections are the endpoints of this route
    const {start, end} = endpoints(routeGeoJSON);
    const midPointIntersections = intersections.filter(({intersection}) => {
      const instPoint = point(intersection);
      return !booleanEqual(instPoint, start) && !booleanEqual(instPoint, end)
    }).map(({intersection}) => intersection);

    if (midPointIntersections.length > 0) {
      console.log(`Route ${route.id} has ${midPointIntersections.length} mid-point intersections`);

      // Dedupe midpoint intersections - two lines can intersect at the same point, but just split once
      const dedupedIntersections = midPointIntersections.filter((point, index) =>
        midPointIntersections.findIndex(p => p[0]===point[0] && p[1]===point[1]) == index);

      // Split route at each intersection
      const newRoutes = lineMultiSplit(routeGeoJSON, dedupedIntersections.map(p => point(p)));

      // Remove the original, add the new routes
      deleteStmt.run(route.id);
      newRoutes.forEach((r, idx) => {
        insertFeature(db, r, route.featureType, route.id * 1000 + idx);
      });
    }
  }
}

function addLengths(db) {
  const allRoutesQuery = db.prepare(ALL_OF_TYPE);
  const updateQuery = db.prepare(UPDATE_GEOJSON);

  for (const route of allRoutesQuery.all('canoe_route')) {
    const geojson = JSON.parse(route.geojson);
    if (geojson.geometry.type === 'LineString') {
      geojson.properties['length'] = length(geojson.geometry, {units: "meters"});
      console.log(`Updating ${route.id} with length ${geojson.properties['length']}`);
      updateQuery.run(JSON.stringify(geojson), route.id);
    }
  }
}

export function prepareDB() {
  const db = Database('./data/features.db');

  divideRouteIntersections(db);

  addLengths(db);
}
