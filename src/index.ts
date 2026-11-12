import { join } from 'node:path';
import { Type } from 'typebox';
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import { TransitService } from './service.js';
import { fetchBytes } from './http.js';
import type { TransitSystem, CallArgs, CallScope } from './types.js';

const limit = Type.Optional(Type.Integer({ minimum: 1, maximum: 20 }));
const text = Type.String({ minLength: 1, maxLength: 160 });
const definitions = [
  { name: 'search_transit_systems', description: 'Search the public MobilityData catalog by city or agency. Results describe coverage and authentication; they do not establish live feed health.', parameters: Type.Object({ query: text, limit }, { additionalProperties: false }),
    run: (s: TransitService,p: CallArgs,c: CallScope) => s.search(p.query!,p.limit ?? 5,c) },
  { name: 'use_transit_system', description: 'After user confirmation, validate and save a catalog system for this agent. Previous selection is preserved on validation failure. Halifax preset ID is mdb-734. This changes the selected system across this agent’s sessions.', parameters: Type.Object({ system_id: text }, { additionalProperties: false }),
    run: (s: TransitService,p: CallArgs,c: CallScope) => s.use(p.system_id!,c) },
  { name: 'get_transit_system', description: 'Read this agent’s transit selection or discover the built-in Halifax preset. Does not change configuration.', parameters: Type.Object({}, { additionalProperties: false }),
    run: (s: TransitService,_p: CallArgs,c: CallScope) => s.current(c) },
  { name: 'search_transit_stops', description: 'Find public boarding stops by name or exact stop ID in the selected system. Confirm direction before choosing a departure.', parameters: Type.Object({ query: text, limit }, { additionalProperties: false }),
    run: (s: TransitService,p: CallArgs,c: CallScope) => s.stops(p.query!,p.limit ?? 5,c) },
  { name: 'get_transit_departures', description: 'Get fresh predicted departures at a resolved boarding stop. Returns absolute ISO timestamps and agency timezones. No schedule fallback, journey planning, or catchability guarantee.', parameters: Type.Object({ stop_id: text, route_id: Type.Optional(text), limit }, { additionalProperties: false }),
    run: (s: TransitService,p: CallArgs,c: CallScope) => s.departures(p.stop_id!,p.limit ?? 5,p.route_id,c) },
  { name: 'get_transit_vehicles', description: 'Read fresh public vehicle positions from the selected system, optionally filtered by route ID. Does not track a person or start background polling.', parameters: Type.Object({ route_id: Type.Optional(text), limit }, { additionalProperties: false }),
    run: (s: TransitService,p: CallArgs,c: CallScope) => s.vehicles(p.route_id,p.limit ?? 10,c) },
];
export default definePluginEntry({
  id: 'hopper-gtfs', name: 'Hopper GTFS Transit',
  description: 'Native transit discovery, selection, and realtime queries; no external MCP executable required.',
  register(api) {
    let service: TransitService | undefined;
    api.registerTool({
      contextVersion: 2,
      create(context) {
        if (!context.agentId) return null;
        const agentId = context.agentId;
        return definitions.map(definition => ({
          name: definition.name, label: definition.name.replaceAll('_',' '),
          description: definition.description, parameters: definition.parameters,
          async execute(_id: string, params: CallArgs, signal?: AbortSignal) {
            context.assertInvocationCurrent();
            service ??= new TransitService(fetchBytes,
              api.runtime.state.openKeyedStoreV2<TransitSystem>({ namespace: 'selected-system', retention: 'retained' }),
              join(api.runtime.state.resolveStateDir(process.env),'cache','hopper-gtfs'));
            const result = await definition.run(service,params,{agentId,signal,assertCurrent:context.assertInvocationCurrent});
            context.assertInvocationCurrent();
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], details: result };
          },
        }));
      },
    }, { names: definitions.map(d => d.name), workspaceAccess: false });
  },
});
