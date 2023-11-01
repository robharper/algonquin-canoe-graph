import * as turf from '@turf/turf';

function safeBooleanContains(feature1, feature2) {
  if (feature1.geometry.type === "MultiPolygon") {
    const childContainers= feature1.geometry.coordinates
      .filter(coords => safeBooleanContains(turf.polygon(coords), feature2))
    return childContainers.length > 0;
  } else {
    return turf.booleanContains(feature1, feature2);
  }
}

/**
 * Turf extension to find the subset of features that contain a given linestream
 */
export function filterContainsLine(linestring, features) {
  const lineGeoJson = JSON.parse(linestring.geojson);

  const containing = features.filter((toCheck) => {
    const featureGeoJson = JSON.parse(toCheck.geojson);
    const contains = featureGeoJson.geometry.type === 'Polygon' && safeBooleanContains(featureGeoJson, lineGeoJson);
    if (contains) {
      // Pure containment
      return true;
    }

    // booleanContains returns false if there are edge intersections, so we need to do further checks
    const intersections = turf.lineIntersect(featureGeoJson, lineGeoJson);
    if (intersections.features.length >= 2) {
      // Line intersects the feature at two or more points, sufficient to determine it's inside the feature
      return true;
    } else if (intersections.features.length === 1) {
      // Line definitely touches the feature, but does it go in it?
      // Check each end of the line. If one end is inside, the line is contained in the feature
      const startInside = safeBooleanContains(featureGeoJson, turf.point(lineGeoJson.geometry.coordinates[0]));
      const endInside = safeBooleanContains(featureGeoJson, turf.point(lineGeoJson.geometry.coordinates[lineGeoJson.geometry.coordinates.length - 1]));
      return startInside || endInside;
    } else {
      // No intersection, no containment
      return false;
    }
  });

  return containing;
}