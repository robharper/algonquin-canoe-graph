import { CREATE_CONNECTED_LINK, CREATE_LAKE_LINK, CREATE_NODE, MATCH_LINK, MATCH_NODE } from "./queries.js";


export async function createNode(session, node, nodeType=null) {
  let nodeExists = await session.run(MATCH_NODE, {id: node.id});
  if (nodeExists.records.length === 0) {
    await session.run(CREATE_NODE[nodeType ?? node.featureType], {props: {
      id: node.id,
      name: node.name,
      featureType: node.featureType,
      featureId: node.featureId,
      geometryType: node.geometryType,
    }});
  }
}

export async function createIntersectionLink({session, point, start, end}) {
  // Determine if link between exists
  let linkExists = await session.run(MATCH_LINK, { start: start.id, end: end.id });
  const count = linkExists.records[0].get('lnkCnt').toInt();
  if (count === 0) {
    return session.run(CREATE_CONNECTED_LINK.replace("REPLACE_ME", `[${point}]`), { start: start.id, end: end.id });
  }
}

export async function createContainsLink({session, start, end}) {
  return session.run(CREATE_LAKE_LINK, { start: start.id, end: end.id });
}