docker run --rm --publish=7474:7474 --publish=7687:7687 -e NEO4J_PLUGINS=\[\"apoc\"\] -e NEO4J_AUTH=neo4j/${NEO4J_PASSWORD} neo4j:5.12.0
