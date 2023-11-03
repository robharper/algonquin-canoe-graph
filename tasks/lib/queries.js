//------------------------------------------------------------------------------------
// Sqlite
export const INSERT_STMT = `INSERT INTO features
  (id, minX, maxX, minY, maxY, featureId, name, featureType, geometryType, geojson)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const UPDATE_GEOJSON = `UPDATE features SET geojson=? WHERE id=?`;

export const DB_FIND_OVERLAPS_BY_TYPE = `SELECT f.* FROM features AS f, features AS TARGET
WHERE f.maxX>=(TARGET.minX - 0.000125) AND f.minX<=(TARGET.maxX + 0.000125)
  AND f.maxY>=(TARGET.minY - 0.000125) AND f.minY<=(TARGET.maxY + 0.000125)
  AND f.featureType=?
  AND TARGET.id=?;`;

export const DB_FIND_OVERLAPS = `SELECT f.* FROM features AS f, features AS TARGET
WHERE f.maxX>=(TARGET.minX - 0.000125) AND f.minX<=(TARGET.maxX + 0.000125)
  AND f.maxY>=(TARGET.minY - 0.000125) AND f.minY<=(TARGET.maxY + 0.000125)
  AND TARGET.id=?;`;

export const ALL_OF_TYPE = `SELECT * FROM features where featureType=?`;

//------------------------------------------------------------------------------------
// Cypher

export const MATCH_NODE = `MATCH (f {id: $id}) RETURN f.id`;

export const MATCH_LINK = `MATCH (s {id: $start})-[l]-(e {id: $end}) RETURN count(l) as lnkCnt`;

export const CREATE_NODE = {
  'lake': 'CREATE (n:Lake:Feature $props)',
  'river': 'CREATE (n:River:Feature $props)',
  'portage': 'CREATE (n:Portage $props)',
  'route': 'CREATE (n:Route $props)',
  'access_point': 'CREATE (n:Feature:AccessPoint $props)',
};

export const CREATE_CONNECTED_LINK = `MATCH (s {id: $start})
                      MATCH (e {id: $end})
                      CREATE (s)-[:CONNECTED_TO {point:REPLACE_ME}]->(e)`;

export const CREATE_LAKE_LINK = `MATCH (s:Feature {id: $start})
                      MATCH (e {id: $end})
                      MERGE (s)-[:CONTAINS]->(e)`;

export const DELETE_LEAF_RIVERS = `
  MATCH (n:River)
  WHERE apoc.node.degree(n) <= 2
  DETACH DELETE n
  RETURN COUNT(n);`;

export const DELETE_DISCONNECTED = `
  MATCH (n:Feature)
  WHERE not (n)--()
  DELETE n
  RETURN COUNT(n)`;

export const DELETE_LEAF_UNNAMED_LAKES = `
  MATCH (n:Lake)
  WHERE n.name is null and apoc.node.degree(n) <= 2
  DETACH DELETE n
  RETURN COUNT(n)`;
