import { mapMeta, stations, plannedStations, lines } from './stations';
import symbols from './station-symbols.json';
import routes from './route-paths.json';
import vectorBasemap from './vector-basemap.json';
import labels from './station-labels.json';
import englishNames from './station-english.json';
import visitedStations from './visited-stations.json';
import coordinates from './station-coordinates.json';
import stationNotes from './station-notes.json';
import basemap from './basemap.json';
import transportTransfers from './transport-transfers.json';
import { stationOperators } from './operators';
import { lineNames } from './line-names';

export interface Coordinate { lat: number; lon: number }
export interface StationSymbolGeometry {
  parts: { x: number; y: number; width: number; height: number; angle: number; lines: string[]; transfer: boolean; planned?: boolean }[];
  connections?: { x1: number; y1: number; x2: number; y2: number; points?: string; kind: string }[];
}
export interface StationLabel { x: number; y: number; anchor: 'start' | 'middle' | 'end'; fontSize: number; englishLineLength?: number }
export interface MetroStation {
  id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[];
  status?: 'planned'; englishName?: string; label?: StationLabel; symbol?: StationSymbolGeometry;
}
export interface MetroOperator { id: string; name: string; company: string; url: string; logo?: string }
export interface TransportTransfer {
  mode: 'rail' | 'highSpeedRail' | 'airport' | 'ferry' | 'gdIntercity';
  destination: string; access: 'direct' | 'walk' | 'shuttle';
  railways?: string[];
}
export interface MetroCityDataset {
  city: { id: string; name: string; assetBase: string; center: [number, number]; geographicBounds: [[number, number], [number, number]] };
  mapMeta: { width: number; height: number };
  stations: MetroStation[]; plannedStations: MetroStation[];
  lines: { id: string; name: string; color: string }[];
  symbols: Record<string, StationSymbolGeometry>;
  routes: { id: string; color: string; width: number; paths: string[] }[];
  vectorBasemap: { layers: { kind: string; fill: string; stroke?: string; strokeWidth?: number; paths: string[] }[] };
  labels: Record<string, StationLabel>; englishNames: Record<string, string>;
  visitedStations: string[]; coordinates: Record<string, Coordinate>; stationNotes: Record<string, string>;
  basemap: { base: string; tileset: string; theme: string; attribution: string; maxZoom: number };
  operatorsByStation: Record<string, MetroOperator[]>; lineNames: Record<string, string>;
  transportTransfers?: Record<string, TransportTransfer[]>;
}

export const shenzhenDataset: MetroCityDataset = {
  city: { id: 'shenzhen', name: '深圳', assetBase: '', center: [114.05, 22.62], geographicBounds: [[113.70, 22.40], [114.47, 22.86]] },
  mapMeta, stations, plannedStations, lines,
  symbols: symbols as Record<string, StationSymbolGeometry>, routes, vectorBasemap,
  labels: labels as Record<string, StationLabel>, englishNames,
  visitedStations, coordinates, stationNotes, basemap, lineNames,
  transportTransfers: transportTransfers as Record<string, TransportTransfer[]>,
  operatorsByStation: Object.fromEntries([...stations, ...plannedStations].map(station => [station.id, stationOperators(station)])),
};
