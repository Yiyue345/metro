import { mapMeta, stations as sourceStations, plannedStations as sourcePlannedStations, lines as sourceLines } from '../../../chengdu/data/stations';
import sourceSymbols from '../../../chengdu/data/station-symbols.json';
import sourceRoutes from '../../../chengdu/data/route-paths.json';
import labels from '../../../chengdu/data/station-labels.json';
import englishNames from '../../../chengdu/data/station-english.json';
import sourceVisitedStations from '../../../chengdu/data/visited-stations.json';
import coordinates from '../../../chengdu/data/station-coordinates.json';
import sourceStationNotes from '../../../chengdu/data/station-notes.json';
import basemap from '../../../chengdu/data/basemap.json';
import sourceTransportTransfers from '../../../chengdu/data/transport-transfers.json';
import operators from '../../../chengdu/data/station-operators.json';
import roster from '../../../chengdu/data/official-roster.json';
import { registerDiagram } from './map-registration.mjs';
import { validateVisitedStations } from './validate-visited.mjs';
import { validateStationNotes } from './validate-station-notes.mjs';
import type { MetroCityDataset, Coordinate, StationLabel, StationSymbolGeometry, TransportTransfer } from './metro-city';

const hidden = new Set<string>(roster.hiddenLineIds);
const visibleStation = (station: typeof sourceStations[number]) => ({ ...station, lines: station.lines.filter(id => !hidden.has(id)) });
const stations = sourceStations.map(visibleStation).filter(station => station.lines.length > 0);
const plannedStations = sourcePlannedStations.map(visibleStation).filter(station => station.lines.length > 0);
const stationIds = new Set([...stations, ...plannedStations].map(station => station.id));
const lines = sourceLines.filter(line => !hidden.has(line.id));
const routes = sourceRoutes.filter(route => !hidden.has(route.id));
const symbols = Object.fromEntries(Object.entries(sourceSymbols).filter(([id]) => stationIds.has(id)).map(([id, value]) => {
  const geometry = value as StationSymbolGeometry;
  const parts = geometry.parts.map(part => ({ ...part, lines: part.lines.filter(line => !hidden.has(line)) })).filter(part => part.lines.length > 0);
  return [id, { ...geometry, parts, ...(parts.length < geometry.parts.length ? { connections: [] } : {}) }];
}));
const visibleOperatingIds = new Set(stations.map(station => station.id));
const visitedStations = validateVisitedStations(sourceVisitedStations, new Set(sourceStations.map(station => station.id))).filter(id => visibleOperatingIds.has(id));
validateStationNotes(sourceStationNotes, new Set([...sourceStations, ...sourcePlannedStations].map(station => station.id)));
const stationNotes = Object.fromEntries(Object.entries(sourceStationNotes as Record<string, string>).filter(([id]) => stationIds.has(id)));
const transportTransfers = Object.fromEntries(Object.entries(sourceTransportTransfers).filter(([id]) => visibleOperatingIds.has(id)));
const registration = registerDiagram([...stations, ...plannedStations], coordinates, mapMeta.width);
const registered = Object.values(registration.stationCoordinates) as Coordinate[];
const geographicBounds: [[number, number], [number, number]] = [
  [Math.min(...registered.map(point => point.lon)) - .09, Math.min(...registered.map(point => point.lat)) - .07],
  [Math.max(...registered.map(point => point.lon)) + .09, Math.max(...registered.map(point => point.lat)) + .07],
];
const operatorById = new Map(operators.operators.map(operator => [operator.id, operator]));
const lineOperators = operators.lines as Record<string, string[]>;

export const chengduDataset: MetroCityDataset = {
  city: { id: 'chengdu', name: '成都', assetBase: '/chengdu', center: [104.065, 30.64], geographicBounds },
  mapMeta, stations, plannedStations, lines,
  symbols: symbols as Record<string, StationSymbolGeometry>, routes,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames: {},
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  diagramRegistration: { origin: registration.origin, east: registration.east },
  operatorsByStation: Object.fromEntries([...stations, ...plannedStations].map(station => [station.id,
    [...new Set(station.lines.flatMap(line => lineOperators[line] ?? []))].flatMap(id => {
      const operator = operatorById.get(id);
      return operator ? [operator] : [];
    }),
  ])),
};
