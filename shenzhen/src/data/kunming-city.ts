import { mapMeta, stations, plannedStations, lines } from '../../../kunming/data/stations';
import symbols from '../../../kunming/data/station-symbols.json';
import routes from '../../../kunming/data/route-paths.json';
import labels from '../../../kunming/data/station-labels.json';
import englishNames from '../../../kunming/data/station-english.json';
import visitedStations from '../../../kunming/data/visited-stations.json';
import coordinates from '../../../kunming/data/station-coordinates.json';
import stationNotes from '../../../kunming/data/station-notes.json';
import basemap from '../../../kunming/data/basemap.json';
import transportTransfers from '../../../kunming/data/transport-transfers.json';
import { registerDiagram } from './map-registration.mjs';
import type { MetroCityDataset, Coordinate, StationLabel, StationSymbolGeometry, TransportTransfer } from './metro-city';

const registration = registerDiagram(stations, coordinates, mapMeta.width);
const registered = Object.values(registration.stationCoordinates) as Coordinate[];
const geographicBounds: [[number, number], [number, number]] = [
  [Math.min(...registered.map(point => point.lon)) - .09, Math.min(...registered.map(point => point.lat)) - .07],
  [Math.max(...registered.map(point => point.lon)) + .09, Math.max(...registered.map(point => point.lat)) + .07],
];
const metroOperator = { id: 'kunming-metro', name: '昆明地铁', company: '昆明地铁运营有限公司', url: 'https://www.kmgdgs.com/' };
const line4Operator = { id: 'kunming-line4', name: '云南京建轨道交通', company: '云南京建轨道交通投资建设有限公司', url: 'https://www.bjucd.com/' };

export const kunmingDataset: MetroCityDataset = {
  city: { id: 'kunming', name: '昆明', assetBase: '/kunming', center: [102.75, 24.98], geographicBounds },
  mapMeta, stations, plannedStations, lines,
  symbols: symbols as Record<string, StationSymbolGeometry>, routes,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames: {},
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  operatorsByStation: Object.fromEntries(stations.map(station => [station.id, [
    ...(station.lines.some(line => line !== '4') ? [metroOperator] : []),
    ...(station.lines.includes('4') ? [line4Operator] : []),
  ]])),
};
