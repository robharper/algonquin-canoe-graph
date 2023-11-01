
export function endpoints(line) {
  return {
    start: point(line.geometry.coordinates[0]),
    end: point(line.geometry.coordinates[line.geometry.coordinates.length - 1])
  }
}