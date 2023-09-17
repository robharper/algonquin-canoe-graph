const fs = require('fs');
const osmtogeojson = require('osmtogeojson');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

const URL = "http://overpass-api.de/api/interpreter"

const QUERY_PORTAGES = `
    area(id:3600910784)->.searchArea;
    (
    way[canoe=portage](area.searchArea);
    );
    `
const QUERY_RIVERS = `
    area(id:3600910784)->.searchArea;
    (
    way[waterway~"^(river|stream)$"](area.searchArea);
    );
    `
const QUERY_CAMPSITES = `
    area(id:3600910784)->.searchArea;
    (
    nwr[tourism=camp_site](area.searchArea);
    );
    `
const QUERY_LAKES = `
    area(id:3600910784)->.searchArea;
    (
    nwr[natural=water](area.searchArea);
    );
    `

const LAYERS = [
    {
        query: QUERY_PORTAGES,
        name: "portages"
    },
    {
        query: QUERY_RIVERS,
        name: "rivers"
    },
    {
        query: QUERY_CAMPSITES,
        name: "campsites"
    },
    {
        query: QUERY_LAKES,
        name: "lakes"
    }
]


async function request(q) {
  const query_str = `[out:json]; ${q} out geom;`
  const response = await fetch(URL, {
    data: query_str,
  });
  return await response.json();
}

async function execute() {
  await Promise.all(LAYERS.map(async (layer) => {
    // Skip if file exists
    const osmFile = `./geojson/${layer.name}.osm.json`;
    let osmData;
    if (!fs.existsSync(osmFile)) {
      console.log(`Requesting ${layer.name}...`);
      osmData = await request(layer.query);
      // Write data to file
      fs.writeFileSync(osmFile, JSON.stringify(osmData));
    } else {
      const osmJson = fs.readFileSync(osmFile);
      osmData = JSON.parse(osmJson);
    }

    // Convert osm to geojson, only if the file doesn't exist
    console.log(`Converting osm to geojson for ${layer.name}...`);
    const geojsonFile = `./geojson/${layer.name}.geo.json`;
    const geojson = osmtogeojson(osmData);

    fs.writeFileSync(geojsonFile, JSON.stringify(geojson));
  }));

  // Build mbtiles
  // List all .geo.json files in geojson directory
  const geojsonFiles = fs.readdirSync('./geojson').filter(file => file.endsWith('.geo.json'));
  await Promise.all(geojsonFiles.map(async (file) => {
    console.log(`Building mbtiles for ${file}...`);
    // Name
    const layerName = file.split('.')[0];
    // Call tippecanoe subprocess
    const { stderr } = await exec(`tippecanoe -L${layerName}:${'./geojson/'+file} --force --projection=EPSG:4326 -Z8 -z14 -o./mbtiles/${layerName}.mbtiles`);
    console.log(stderr);
  }));

  // Merge all layers into one mbtiles
  console.log('Combining...')
  const layerList = geojsonFiles.map(file => `./mbtiles/${file.split('.')[0]}.mbtiles`).join(' ');
  const { stderr } = await exec(`tile-join -oalgonquin.mbtiles --force -pk -n algonquin ${layerList}`);
  console.log(stderr);
}

execute();
