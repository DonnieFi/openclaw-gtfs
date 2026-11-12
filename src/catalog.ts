import { parse } from 'csv-parse/sync';
import type { Feed, TransitSystem } from './types.js';

export const CATALOG_URL = 'https://files.mobilitydatabase.org/feeds_v2.csv';
type Row = Record<string, string>;
function cells(value: string | undefined): string[] {
  return (value ?? '').split(/[;,|\s]+/).filter(Boolean);
}
function feed(row: Row): Feed | undefined {
  const value = row['urls.direct_download']?.trim();
  if (!value) return undefined;
  let url: URL;
  try { url = new URL(value); } catch { return undefined; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
  // The maintained Halifax preset uses its verified TLS endpoint; do not upgrade arbitrary URLs.
  if (url.hostname === 'gtfs.halifax.ca') url.protocol = 'https:';
  return { url: url.href, requiresAuth: !['', '0'].includes(row['urls.authentication_type'] ?? '') };
}
export function parseCatalog(bytes: Uint8Array): TransitSystem[] {
  const rows: Row[] = parse(bytes, { columns: true, bom: true, skip_empty_lines: true, max_record_size: 100_000 });
  const result: TransitSystem[] = [];
  for (const row of rows) {
    if (row.data_type !== 'gtfs' || !row.id || (row.status && row.status !== 'active')) continue;
    const schedule = feed(row);
    if (!schedule) continue;
    const system: TransitSystem = {
      id: row.id, name: row.provider || row.name || row.id,
      location: [row['location.municipality'], row['location.subdivision_name'], row['location.country_code']].filter(Boolean).join(', '),
      status: row.status || 'unspecified', schedule, tripUpdates: [], vehicles: [], alerts: [],
      ...(row['urls.license'] ? { licenseUrl: row['urls.license'] } : {}),
    };
    for (const realtime of rows) {
      if (!['gtfs_rt', 'gtfs-rt'].includes(realtime.data_type ?? '') ||
          (realtime.status && realtime.status !== 'active') ||
          !cells(realtime.static_reference).includes(row.id)) continue;
      const endpoint = feed(realtime);
      if (!endpoint) continue;
      const types = cells(realtime.entity_type);
      if (types.includes('tu')) system.tripUpdates.push(endpoint);
      if (types.includes('vp')) system.vehicles.push(endpoint);
      if (types.includes('sa')) system.alerts.push(endpoint);
    }
    result.push(system);
  }
  if (!result.length) throw new Error('The catalog contains no active schedule feeds.');
  return result;
}
export function searchCatalog(systems: TransitSystem[], query: string, limit = 5): TransitSystem[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error('Enter a city or agency name.');
  return systems.filter(system => {
    const text = (system.name + ' ' + system.location).toLocaleLowerCase();
    return words.every(word => text.includes(word));
  }).sort((a,b) => a.name.length - b.name.length || a.id.localeCompare(b.id)).slice(0,limit);
}
