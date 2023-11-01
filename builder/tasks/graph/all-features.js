import { findIntersections } from '../geo/intersection.js';
import { createIntersectionLink, createNode } from '../lib/graph-queries.js';
import { DB_FIND_OVERLAPS } from '../lib/queries.js';

async function processFeature(node, db, session) {
  // Insert node into graph
  await createNode(session, node);

  // Find all intersecting geometries - add a 10m buffer (0.000125 degrees is about 10m at 45 lat)
  const queryStmt = db.prepare(DB_FIND_OVERLAPS);

  const possibleIntersections = queryStmt.all(node.id);

  const intersections = findIntersections(node, possibleIntersections, false);
  if (intersections.length > 0) {
    for (const {feature, intersection} of intersections) {
      await createNode(session, feature);
      await createIntersectionLink({session, point: intersection, start: node, end: feature});
    }
  } else {
    console.log(`No intersections for ${node.name} (${node.id})`);
  }
}

/**
 * Create a graph from all features creating links between all intersections of any feature type
 */
export async function graphAllFeatures(db) {
  const allFeatures = db.prepare(`SELECT * FROM features`);
  for (const feature of allFeatures.iterate()) {
    console.log(`Processing ${feature.name}`);
    await processFeature(feature, db, session);
  }
}