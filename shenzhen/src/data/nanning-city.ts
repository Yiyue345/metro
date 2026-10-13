import { mapMeta, stations, plannedStations, lines } from '../../../nanning/data/stations';
import symbols from '../../../nanning/data/station-symbols.json';
import routes from '../../../nanning/data/route-paths.json';
import labels from '../../../nanning/data/station-labels.json';
import englishNames from '../../../nanning/data/station-english.json';
import visitedStations from '../../../nanning/data/visited-stations.json';
import coordinates from '../../../nanning/data/station-coordinates.json';
import stationNotes from '../../../nanning/data/station-notes.json';
import basemap from '../../../nanning/data/basemap.json';
import transportTransfers from '../../../nanning/data/transport-transfers.json';
import { registerDiagram } from './map-registration.mjs';
import type { MetroCityDataset, Coordinate, StationLabel, StationSymbolGeometry, TransportTransfer } from './metro-city';

// Bound the viewport to the same uniformly registered linework used by the map.
const registration = registerDiagram([...stations, ...plannedStations], coordinates, mapMeta.width);
const registered = Object.values(registration.stationCoordinates) as Coordinate[];
const geographicBounds: [[number, number], [number, number]] = [
  [Math.min(...registered.map(point => point.lon)) - .09, Math.min(...registered.map(point => point.lat)) - .07],
  [Math.max(...registered.map(point => point.lon)) + .09, Math.max(...registered.map(point => point.lat)) + .07],
];
const operator = { id: 'nanning', name: '南宁轨道交通', company: '南宁轨道交通集团有限责任公司', url: 'https://www.nngdjt.com/' };

export const nanningDataset: MetroCityDataset = {
  city: { id: 'nanning', name: '南宁', assetBase: '/nanning', center: [108.32, 22.82], geographicBounds },
  mapMeta, stations, plannedStations, lines,
  symbols: symbols as Record<string, StationSymbolGeometry>, routes,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames: {},
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  operatorsByStation: Object.fromEntries(stations.map(station => [station.id, [operator]])),
};
