export type Feed = { url: string; requiresAuth: boolean };
export type TransitSystem = {
  id: string; name: string; location: string; status: string;
  schedule: Feed; tripUpdates: Feed[]; vehicles: Feed[]; alerts: Feed[];
  licenseUrl?: string;
};
export type CallScope = { agentId: string; assertCurrent: () => void; signal?: AbortSignal };
export type FetchBytes = (url: string, maxBytes: number, scope: CallScope) => Promise<Uint8Array>;
export type SelectedSystemStore = {
  lookup(key: string): Promise<TransitSystem | undefined>;
  register(key: string, value: TransitSystem, options: { assertCurrent: () => void }): Promise<void>;
};
export type StopInfo = { stop_id: string; stop_name: string; stop_lat: number; stop_lon: number };
export type TripInfo = { trip_id: string; route_id: string; trip_headsign: string | null; direction_id: number | null };
export type RouteInfo = { route_id: string; route_short_name: string | null; route_long_name: string | null };
export type CallArgs = { query?: string; system_id?: string; stop_id?: string; route_id?: string; limit?: number };
