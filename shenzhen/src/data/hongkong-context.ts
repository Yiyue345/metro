import stations from '../../../hongkong-context/data/stations.json';
import symbols from '../../../hongkong-context/data/station-symbols.json';
import routes from '../../../hongkong-context/data/route-paths.json';
import labels from '../../../hongkong-context/data/station-labels.json';
import englishNames from '../../../hongkong-context/data/station-english.json';
import coordinates from '../../../hongkong-context/data/station-coordinates.json';
import roster from '../../../hongkong-context/data/official-roster.json';
import colors from '../../../hongkong-context/data/line-colors.json';
import diagramRegistration from '../../../hongkong-context/data/diagram-registration.json';
import basemap from './basemap.json';
import { registerDiagram } from './map-registration.mjs';
import type { MetroCityDataset, StationSymbolGeometry, StationLabel } from './metro-city';

// Context-only dataset: never placed in the city selector, search or visit totals.
export const hongkongContext: MetroCityDataset = {
  city: { id: 'hongkong-context', name: '香港', assetBase: '', center: [114.15, 22.4], geographicBounds: [[113.9, 22.26], [114.3, 22.56]] },
  mapMeta: { width: 4375, height: 3125 },
  stations, plannedStations: [],
  lines: roster.lines.map(line => ({ id: line.id, name: line.name, color: colors[line.id as keyof typeof colors] })),
  symbols: symbols as Record<string, StationSymbolGeometry>, routes,
  labels: labels as Record<string, StationLabel>, englishNames, coordinates,
  visitedStations: [], stationNotes: {}, operatorsByStation: {}, lineNames: {}, basemap, diagramRegistration,
};

export interface BorderCrossing {
  id: string; title: string; from: { x: number; y: number }; to: { x: number; y: number };
}
export function borderCrossings(home: MetroCityDataset, context: MetroCityDataset): BorderCrossing[] {
  if (home.city.id !== 'shenzhen' || context.city.id !== 'hongkong-context') return [];
  const registration = registerDiagram(home.stations, home.coordinates, home.mapMeta.width, home.diagramRegistration);
  const project = (p: { lon: number; lat: number }) => [p.lon / 360 + .5, (1 - Math.log(Math.tan(Math.PI / 4 + p.lat * Math.PI / 360)) / Math.PI) / 2];
  const origin = project(diagramRegistration.origin), scale = (project(diagramRegistration.east)[0] - origin[0]) / context.mapMeta.width;
  const pairs = [{ id: 'luohu', home: '罗湖', context: 'LOW', title: '羅湖口岸 · 需通關' }, { id: 'lok-ma-chau', home: '福田口岸', context: 'LMC', title: '福田／落馬洲口岸 · 需通關' }];
  return pairs.map(pair => {
    const homePoint = project(registration.stationCoordinates[pair.home]), station = context.stations.find(station => station.id === pair.context)!;
    return { id: pair.id, title: pair.title, from: { x: (homePoint[0] - origin[0]) / scale, y: (homePoint[1] - origin[1]) / scale }, to: { x: station.x, y: station.y } };
  });
}
