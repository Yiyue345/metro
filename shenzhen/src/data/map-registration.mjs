// A single north-up scale and translation for the entire SVG. Never warp
// individual routes, stations, labels, or the width/height ratio.
export function registerDiagram(stations, coordinates, width) {
  const project = ({ lon, lat }) => [lon / 360 + .5,
    (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
  const unproject = ([x, y]) => ({ lon: (x - .5) * 360,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI });
  const controls = stations.filter(station => coordinates[station.id]).map(station => ({
    source: [station.x, station.y], target: project(coordinates[station.id]),
  }));
  const mean = key => [0, 1].map(axis => controls.reduce((sum, point) => sum + point[key][axis], 0) / controls.length);
  const source = mean('source'), target = mean('target');
  let numerator = 0, denominator = 0;
  for (const point of controls) for (let axis = 0; axis < 2; axis++) {
    const delta = point.source[axis] - source[axis];
    numerator += delta * (point.target[axis] - target[axis]);
    denominator += delta * delta;
  }
  const scale = numerator / denominator;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid diagram registration');
  const locate = (x, y) => unproject([target[0] + (x - source[0]) * scale, target[1] + (y - source[1]) * scale]);
  return {
    origin: locate(0, 0), east: locate(width, 0),
    stationCoordinates: Object.fromEntries(stations.map(station => [station.id, locate(station.x, station.y)])),
  };
}
