import * as turf from '@turf/turf';

/**
 * Finds the distance between two lines based on their ends. Measures end of line1 to line2 and vice versa.
 * Does not find the distance between them at their midpoints, for example.
 * @param {*} line1
 * @param {*} line2
 * @returns
 */
export function distanceBetweenLines(line1, line2) {
  // Two lines
  const distances = [
    {start: line1.geometry.coordinates[0], end: line1.geometry.coordinates[line1.geometry.coordinates.length - 1], line: line2},
    {start: line2.geometry.coordinates[0], end: line2.geometry.coordinates[line2.geometry.coordinates.length - 1], line: line1}
  ].map(({start, end, line}) => {
    const startDist = turf.pointToLineDistance(start, line);
    const endDist = turf.pointToLineDistance(end, line);
    return startDist < endDist ? [startDist, start] : [endDist, end];
  }).sort((a, b) => a[0] - b[0]);

  return distances[0];
}
