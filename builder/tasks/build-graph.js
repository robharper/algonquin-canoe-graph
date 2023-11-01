import Database from 'better-sqlite3';
import graphDb from 'neo4j-driver';
import { DELETE_LEAF_RIVERS, DELETE_LEAF_UNNAMED_LAKES, DELETE_DISCONNECTED } from './lib/queries.js';
import { graphCanoeRoutes } from './graph/canoe-routes.js';
import { graphAllFeatures } from './graph/all-features.js';

const URI = 'bolt://localhost:7687';
const USER = 'neo4j';
const PASSWORD = 'abcd1234';

const SQLITEDB = './data/features.db';


export async function buildGraph(allFeatures=false) {
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

    if (allFeatures) {
      await graphAllFeatures(db, session);
    } else {
      await graphCanoeRoutes(db, session);
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



