import fs from 'fs';
import util from 'node:util';
import { exec as e } from 'node:child_process';
const exec = util.promisify(e);


/**
 * This script converts all geojson files in the data/geojson directory to mbtiles
 */
export async function buildTiles() {
  // Build mbtiles
  // List all .geo.json files in geojson directory
  const geojsonFiles = fs.readdirSync('./data/geojson').filter(file => file.endsWith('.geo.json'));
  await Promise.all(geojsonFiles.map(async (file) => {
    console.log(`Building mbtiles for ${file}...`);
    // Name
    const layerName = file.split('.')[0];
    // Call tippecanoe subprocess
    const { stderr } = await exec(`tippecanoe -L${layerName}:${'./data/geojson/'+file} --force --projection=EPSG:4326 -Z8 -z14 -o./data/mbtiles/${layerName}.mbtiles`);
    console.log(stderr);
  }));

  // Merge all layers into one mbtiles
  console.log('Combining...')
  const layerList = geojsonFiles.map(file => `./data/mbtiles/${file.split('.')[0]}.mbtiles`).join(' ');
  const { stderr } = await exec(`tile-join -o./data/mbtiles/algonquin.mbtiles --force -pk -n algonquin ${layerList}`);
  console.log(stderr);
}
