import assert from 'assert';
import {lineSplit, booleanPointOnLine} from '@turf/turf';

/**
 * Like turf.lineSplit but accepts an array of points and splits the line at all of them
 */
export function lineMultiSplit(line, splitArray) {
  let results = [line];
  for (const splitPoint of splitArray) {
    // Find the line in the results that contains the split point
    const lineIndex = results.findIndex((line) => booleanPointOnLine(splitPoint, line));
    if (lineIndex > -1) {
      // Split the line
      const splitLine = results[lineIndex];
      const splitResult = lineSplit(splitLine, splitPoint);

      assert.equal(splitResult.features.length, 2);

      // Ensure the geojson properties are copied over
      splitResult.features.forEach((feature) => {
        feature.properties = splitLine.properties;
      });

      // if (splitResult.features.length !== 2) {
      //   console.log(`Splitting ${splitLine.id} at ${splitPoint.geometry.coordinates} resulted in ${splitResult.features.length} features`);
      // }

      results.splice(lineIndex, 1, splitResult.features[0], splitResult.features[1]);
    }
  }
  return results;
}