import { parentPort, workerData } from 'node:worker_threads';
import { importGtfs, openDb, closeDb, getStops, getTrips, getRoutes, getStoptimes, getAgencies } from 'gtfs';
import Database from 'better-sqlite3';
import { parseCatalog } from './catalog.js';
import type { TransitSystem, StopInfo, TripInfo, RouteInfo } from './types.js';

export type ScheduleRequest =
  | { op: 'catalog'; bytes: Uint8Array }
  | { op: 'import'; archive: string; database: string }
  | { op: 'info'; database: string }
  | { op: 'stops'; database: string; query: string; limit: number }
  | { op: 'trip-data'; database: string; stopId: string; tripIds: string[] };
export type ScheduleResult = {
  systems?: TransitSystem[]; stops?: StopInfo[]; timezones?: string[];
  trips?: TripInfo[]; routes?: RouteInfo[];
  boarding?: { trip_id: string; stop_sequence: number; pickup_type: number | null }[];
};
export type WorkerReply = { ok: true; result: ScheduleResult } | { ok: false; error: string };

async function run(request: ScheduleRequest): Promise<ScheduleResult> {
  if (request.op === 'catalog') return { systems: parseCatalog(request.bytes) };
  if (request.op === 'import') {
    try {
      await importGtfs({ agencies: [{ path: request.archive }], sqlitePath: request.database, logLevel: 'silent', ignoreDuplicates: true });
    } finally {
      closeDb(openDb({ sqlitePath: request.database }));
    }
  }
  const db = new Database(request.database, { readonly: true, fileMustExist: true });
  const options = { db };
  try {
    if (request.op === 'import' || request.op === 'info') {
      const timezones = [...new Set(getAgencies({}, ['agency_timezone'], [], options).map(a => a.agency_timezone))];
      if (!timezones.length) throw new Error('Feed has no agency timezone.');
      for (const zone of timezones) new Intl.DateTimeFormat('en', { timeZone: zone });
      if (!getStops({}, ['stop_id'], [], options).length) throw new Error('Feed has no stops.');
      return { timezones };
    }
    if (request.op === 'stops') {
      const q = request.query.toLocaleLowerCase().trim();
      const stops = getStops({}, ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'], [], options)
        .filter(s => s.stop_id === request.query || (s.stop_name ?? '').toLocaleLowerCase().includes(q))
        .slice(0, request.limit)
        .flatMap(s => typeof s.stop_name === 'string' && typeof s.stop_lat === 'number' && typeof s.stop_lon === 'number'
          ? [{ stop_id: s.stop_id, stop_name: s.stop_name, stop_lat: s.stop_lat, stop_lon: s.stop_lon }] : []);
      return { stops };
    }
    const stop = getStops({ stop_id: request.stopId }, ['stop_id'], [], options);
    if (!stop.length) throw new Error('Unknown boarding stop; search stops first.');
    if (!request.tripIds.length) return { trips: [], routes: [], boarding: [] };
    const trips = getTrips({ trip_id: request.tripIds }, ['trip_id', 'route_id', 'trip_headsign', 'direction_id'], [], options)
      .map(t => ({ trip_id: t.trip_id, route_id: t.route_id, trip_headsign: t.trip_headsign ?? null, direction_id: t.direction_id ?? null }));
    const routeIds = [...new Set(trips.map(t => t.route_id))];
    const routes = routeIds.length ? getRoutes({ route_id: routeIds }, ['route_id', 'route_short_name', 'route_long_name'], [], options)
      .map(r => ({ route_id: r.route_id, route_short_name: r.route_short_name ?? null, route_long_name: r.route_long_name ?? null })) : [];
    const boarding = getStoptimes({ stop_id: request.stopId, trip_id: request.tripIds }, ['trip_id', 'stop_sequence', 'pickup_type'], [], options)
      .map(s => ({ trip_id: s.trip_id, stop_sequence: s.stop_sequence, pickup_type: s.pickup_type ?? null }));
    return { trips, routes, boarding };
  } finally { db.close(); }
}

if (parentPort) {
  const request: ScheduleRequest = workerData;
  run(request).then(
    result => parentPort?.postMessage({ ok: true, result } satisfies WorkerReply),
    error => parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies WorkerReply),
  );
}
