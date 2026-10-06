import { mapMeta, stations, plannedStations, lines } from '../../../dongguan/data/stations';
import symbols from '../../../dongguan/data/station-symbols.json';
import routes from '../../../dongguan/data/route-paths.json';
import vectorBasemap from '../../../dongguan/data/vector-basemap.json';
import labels from '../../../dongguan/data/station-labels.json';
import englishNames from '../../../dongguan/data/station-english.json';
import visitedStations from '../../../dongguan/data/visited-stations.json';
import coordinates from '../../../dongguan/data/station-coordinates.json';
import stationNotes from '../../../dongguan/data/station-notes.json';
import basemap from '../../../dongguan/data/basemap.json';
import transportTransfers from '../../../dongguan/data/transport-transfers.json';
import { registerDiagram } from './map-registration.mjs';
import type { MetroCityDataset, Coordinate, StationLabel, StationSymbolGeometry, TransportTransfer } from './metro-city';

// Bound the viewport to the same uniformly registered linework used by the map.
const registration = registerDiagram([...stations, ...plannedStations], coordinates, mapMeta.width);
const registered = Object.values(registration.stationCoordinates) as Coordinate[];
const geographicBounds: [[number, number], [number, number]] = [
  [Math.min(...registered.map(point => point.lon)) - .09, Math.min(...registered.map(point => point.lat)) - .07],
  [Math.max(...registered.map(point => point.lon)) + .09, Math.max(...registered.map(point => point.lat)) + .07],
];
const operator = { id: 'dongguan', name: '东莞轨道交通', company: '东莞轨道交通有限公司', url: 'https://www.dggdjt.com/' };

export const dongguanDataset: MetroCityDataset = {
  city: { id: 'dongguan', name: '东莞', assetBase: '/dongguan', center: [113.85, 22.95], geographicBounds },
  mapMeta, stations, plannedStations, lines,
  symbols: symbols as Record<string, StationSymbolGeometry>, routes, vectorBasemap,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames: {},
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  operatorsByStation: Object.fromEntries(stations.map(station => [station.id, [operator]])),
};

