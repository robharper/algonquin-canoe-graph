import { findIntersections } from '../geo/intersection.js';
import { filterContainsLine } from '../geo/contains.js';
import { DB_FIND_OVERLAPS_BY_TYPE, ALL_OF_TYPE } from '../lib/queries.js';
import { createContainsLink, createIntersectionLink, createNode } from '../lib/graph-queries.js';

async function processFeature(node, db, session) {
  console.log(`Processing ${node.name} (${node.id})`);

  const nodeGeoJSON = JSON.parse(node.geojson);

  // Insert node into graph
  await createNode(session, node, nodeGeoJSON, nodeGeoJSON.properties?.canoe === 'portage' ? 'portage' : 'route');

  // Find all intersecting canoe routes to build the graph
  const queryStmt = db.prepare(DB_FIND_OVERLAPS_BY_TYPE);
  const possibleIntersections = queryStmt.all("canoe_route", node.id);

  const intersections = findIntersections(node, possibleIntersections, false);
  if (intersections.length > 0) {
    // console.log(`Intersections for ${node.name} (${node.id}): ${intersections.length}}`);
    for (const {feature, intersection} of intersections) {
      const intersectionGeoJson = JSON.parse(feature.geojson);

      await createNode(session, feature, intersectionGeoJson, intersectionGeoJson.properties?.canoe === 'portage' ? 'portage' : 'route');
      await createIntersectionLink({session, point: intersection, start: node, end: feature});
    }
  } else {
    console.log(`No intersections for ${node.name} (${node.id})`);
  }

  // If this isn't a portagefind containing lakes
  if (nodeGeoJSON.properties?.canoe !== 'portage') {
    // Find lakes that contain this route - associate lakes to the routes that cross/are in them
    const lakeQuery = db.prepare(DB_FIND_OVERLAPS_BY_TYPE);
    const overlappingLakes = lakeQuery.all("lake", node.id);

    const lakesThatContainPath = filterContainsLine(node, overlappingLakes);

    // Create contains link from lakes to routes
    for (const lake of lakesThatContainPath) {
      await createNode(session, lake, 'lake');
      await createContainsLink({session, start: lake, end: node});
    }
  }
}

/**
 * Create a graph from canoe routes, layer on lakes
 */
export async function graphCanoeRoutes(db, session) {
  const routes = db.prepare(ALL_OF_TYPE);
  for (const feature of routes.iterate("canoe_route")) {
    // console.log(`Processing ${feature.name}`);
    await processFeature(feature, db, session);
  }
}
