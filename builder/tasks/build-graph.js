import Database from 'better-sqlite3';
import graphDb from 'neo4j-driver';
import { findIntersections } from './lib/intersection.js';

const URI = 'bolt://localhost:7687';
const USER = 'neo4j';
const PASSWORD = 'abcd1234';

const MATCH_NODE = `MATCH (f {id: $id}) RETURN f.id`;
const CREATE_NODE = {
  'lake': 'CREATE (n:Feature:Lake $props)',
  'river': 'CREATE (n:Feature:River $props)',
  'portage': 'CREATE (n:Feature:Portage $props)',
  'access_point': 'CREATE (n:Feature:AccessPoint $props)',
};

const CREATE_LINK = `MATCH (s:Feature {id: $start})
                      MATCH (e:Feature {id: $end})
                      MERGE (s)-[:CONNECTED_TO {point:REPLACE_ME}]->(e)`;


const DELETE_LEAF_RIVERS = `
  MATCH (n:River)
  WHERE apoc.node.degree(n) <= 2
  DETACH DELETE n
  RETURN COUNT(n);`;

const DELETE_DISCONNECTED = `
  MATCH (n:Feature)
  WHERE not (n)--()
  DELETE n
  RETURN COUNT(n)`;

const DELETE_LEAF_UNNAMED_LAKES = `
  MATCH (n:Lake)
  WHERE n.name is null and apoc.node.degree(n) <= 2
  DETACH DELETE n
  RETURN COUNT(n)`;

const SQLITEDB = './data/features.db';

async function processFeature(node, db, session) {
  // Insert node into graph
  let nodeExists = await session.run(MATCH_NODE, {id: node.id});
  if (nodeExists.records.length === 0) {
    await session.run(CREATE_NODE[node.featureType], {props: {
      id: node.id,
      name: node.name,
      featureType: node.featureType,
      featureId: node.featureId,
      geometryType: node.geometryType,
    }});
  }

  // Find all intersecting geometries
  const intersections = findIntersections(db, node, false);
  if (intersections.length > 0) {
    for (const intersection of intersections) {
      const feature = intersection.feature;
      const point = intersection.intersection;
      let nodeExists = await session.run(MATCH_NODE, {id: feature.id});
      if (nodeExists.records.length === 0) {
        await session.run(CREATE_NODE[feature.featureType], {props: {
          id: feature.id,
          name: feature.name,
          featureType: feature.featureType,
          featureId: feature.featureId,
          geometryType: feature.geometryType,
        }});
      }

      await session.run(CREATE_LINK.replace("REPLACE_ME", `[${point}]`), { start: node.id, end: feature.id });
    }
  } else {
    console.log(`No intersections for ${node.name} (${node.id})`);
  }
}

export async function buildGraph() {
  const db = Database(SQLITEDB);

  let driver;
  try {
    driver = graphDb.driver(URI, graphDb.auth.basic(USER, PASSWORD));
    const serverInfo = await driver.getServerInfo();
    console.log('Connection established');
    console.log(serverInfo);

    const session = driver.session();

    // Clear everything
    await session.run(`MATCH (n) DETACH DELETE n;`);

    const allFeatures = db.prepare(`SELECT * FROM features`);
    for (const feature of allFeatures.iterate()) {
      console.log(`Processing ${feature.name}`);
      await processFeature(feature, db, session);
    }

  } catch (error) {
    console.error(error);
  } finally {
    await driver.close();
  }
}

export async function cleanGraph() {
  let driver;
  try {
    driver = graphDb.driver(URI, graphDb.auth.basic(USER, PASSWORD));
    const serverInfo = await driver.getServerInfo();
    console.log('Connection established');
    console.log(serverInfo);

    const session = driver.session();

    // Remove dead-end rivers
    let moreToDelete = true;
    while (moreToDelete) {
      // If there are any leafnode unnamed lakes, delete them
      const lakeResult = await session.run(DELETE_LEAF_UNNAMED_LAKES);
      console.log(`Removed ${lakeResult.records[0].get('COUNT(n)').toInt()} unnamed leaf lakes`);
      // Then delete leaf node rivers
      const riverResult = await session.run(DELETE_LEAF_RIVERS);
      moreToDelete = riverResult.records[0].get('COUNT(n)').toInt() > 0;
      console.log(`Removed ${riverResult.records[0].get('COUNT(n)').toInt()} leaf rivers`);
    }
    // ... repeat until no more leaf rivers exist

    // Remove detached nodes
    await session.run(DELETE_DISCONNECTED);
  } catch (error) {
    console.error(error);
  } finally {
    await driver.close();
  }
}



