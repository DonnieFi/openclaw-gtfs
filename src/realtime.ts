import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
export type RealtimeFeed = transit_realtime.FeedMessage;
export const MAX_FEED_AGE_SECONDS = 120;
export function decodeFeed(bytes: Uint8Array): RealtimeFeed {
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);
  if (feed.header.incrementality === 1) throw new Error('Differential realtime feeds are not supported; a full dataset is required.');
  return feed;
}
export function ageSeconds(timestamp: unknown, nowMs: number): number | null {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(nowMs / 1000 - value);
}
export function freshness(feed: RealtimeFeed, nowMs: number) {
  const age = ageSeconds(feed.header.timestamp, nowMs);
  return { ageSeconds: age, fresh: age !== null && age >= -30 && age <= MAX_FEED_AGE_SECONDS };
}
export type Prediction = { tripId: string; tripKey: string; routeId: string | null; stopId: string; departureMs: number; stopSequence: number | null };
export function departurePredictions(feeds: RealtimeFeed[], stopId: string, nowMs: number): Prediction[] {
  const observations: { update: transit_realtime.ITripUpdate; timestamp: number; baseKey: string; startTime: string }[] = [];
  const starts = new Map<string, Set<string>>();
  for (const feed of feeds) {
    if (!freshness(feed, nowMs).fresh) continue;
    for (const entity of feed.entity) {
      const update = entity.tripUpdate;
      if (entity.isDeleted || !update?.trip?.tripId) continue;
      const timestamp = Number(update.timestamp) || Number(feed.header.timestamp);
      const age = ageSeconds(timestamp, nowMs);
      if (age === null || age > MAX_FEED_AGE_SECONDS || age < -30) continue;
      const baseKey = JSON.stringify([update.trip.tripId, update.trip.startDate || '']);
      const startTime = update.trip.startTime || '';
      let known = starts.get(baseKey);
      if (!known) { known = new Set(); starts.set(baseKey, known); }
      if (startTime) known.add(startTime);
      observations.push({ update, timestamp, baseKey, startTime });
    }
  }
  const latest = new Map<string, { update: transit_realtime.ITripUpdate; timestamp: number }>();
  for (const observation of observations) {
    const { update, timestamp, baseKey } = observation;
    const known = starts.get(baseKey)!;
    // Halifax emits the same trip with startTime present in one update and absent
    // in another. Reconcile that omission only when one explicit instance exists;
    // never merge distinct frequency-service starts or guess an ambiguous instance.
    if (!observation.startTime && known.size > 1) continue;
    const startTime = observation.startTime || known.values().next().value || '';
    const key = JSON.stringify([baseKey, startTime]);
    const previous = latest.get(key);
    // Keep cancellations until reconciliation so a newer cancellation in one
    // endpoint suppresses a still-fresh prediction in another endpoint.
    if (!previous || timestamp > previous.timestamp ||
        (timestamp === previous.timestamp && update.trip?.scheduleRelationship === 3)) {
      latest.set(key, { update, timestamp });
    }
  }
  const predictions: Prediction[] = [];
  for (const [tripKey, { update }] of latest) {
    const trip = update.trip;
    if (!trip?.tripId || trip.scheduleRelationship === 3) continue;
    for (const stop of update.stopTimeUpdate ?? []) {
      if (stop.stopId !== stopId || stop.scheduleRelationship === 1 || stop.scheduleRelationship === 2) continue;
      const departure = Number(stop.departure?.time);
      const seconds = departure > 0 ? departure : Number(stop.arrival?.time);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds * 1000 < nowMs) continue;
      predictions.push({ tripId: trip.tripId, tripKey, routeId: trip.routeId || null, stopId,
        departureMs: seconds * 1000, stopSequence: Object.hasOwn(stop, 'stopSequence') ? stop.stopSequence ?? null : null });
    }
  }
  return predictions.sort((a,b) => a.departureMs - b.departureMs);
}
export function vehiclePositions(feed: RealtimeFeed, nowMs: number, routeId?: string) {
  if (!freshness(feed, nowMs).fresh) return [];
  return feed.entity.flatMap(entity => {
    const vehicle = entity.vehicle;
    if (entity.isDeleted || !vehicle?.position || (routeId && vehicle.trip?.routeId !== routeId)) return [];
    const age = ageSeconds(vehicle.timestamp, nowMs);
    if (age !== null && (age > MAX_FEED_AGE_SECONDS || age < -30)) return [];
    const p = vehicle.position;
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180) return [];
    return [{ vehicleId: vehicle.vehicle?.id || entity.id, label: vehicle.vehicle?.label || null,
      routeId: vehicle.trip?.routeId || null, tripId: vehicle.trip?.tripId || null,
      latitude: p.latitude, longitude: p.longitude, bearing: Object.hasOwn(p, 'bearing') ? p.bearing ?? null : null,
      speedKmh: Object.hasOwn(p, 'speed') && p.speed != null ? p.speed * 3.6 : null, ageSeconds: age }];
  });
}
