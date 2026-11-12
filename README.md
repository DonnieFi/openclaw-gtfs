# Hopper GTFS Transit — development candidate

Native OpenClaw transit tools. This plugin includes its runtime entrypoints and
pinned GTFS dependencies; it does not call a separately installed gtfs-mcp program
or require HOPPER_GTFS_CONFIG.

## Tools

- search_transit_systems: public MobilityData catalog discovery by city/agency.
- use_transit_system: validate and select a system for the invoking agent.
- get_transit_system: read selection; includes the built-in Halifax preset ID mdb-734.
- search_transit_stops: search names or exact public stop IDs.
- get_transit_departures: fresh realtime predictions matched to a static boarding stop.
- get_transit_vehicles: current public vehicle positions, not person tracking.

Install the plugin before using its tools. Search, have the user confirm the
agency, select it, then resolve a stop and query real data. The Halifax preset
works without API keys. Other catalog entries can require credentials; this first
version supports public unauthenticated feeds only. Catalog listings are not proof
of current feed health or licensing permission.

System selection is stored through OpenClaw's plugin-scoped keyed store, keyed
by the host-supplied agent ID. It applies across that agent's sessions, not across
all agents. A failed validation does not replace the prior selection. It stores
public feed choice, not personal whereabouts or commute history.

Static GTFS parsing/SQL use the maintained gtfs library in bounded workers. Derived
schedule databases are cached beneath the host state cache directory; imported
archives are temporary. Realtime values older than 120 seconds or without usable
feed timestamps are not offered as live departures. Differential realtime feeds
are explicitly unsupported in this version. Newer cancellations override older
predictions across associated endpoints; repeated stop visits use their sequence
and boarding rule. No schedule fallback, walking
route, destination itinerary, transfers, alerts-query tool, recurring watch, or
notifications exist. Catalog metadata can list an alerts endpoint without making
it an implemented plugin capability.

The model must use the actual tool schemas. Times are absolute ISO timestamps;
returned agency timezones provide display context. Predictions are not guarantees.

## Build and package from source

With Node 24.22.1 or newer and the compatible OpenClaw SDK available:

    npm ci --ignore-scripts
    npm run build
    npm test
    npm pack

Built JavaScript and manifest metadata are included in the npm artifact. Install
through OpenClaw's native npm-pack or registry path so dependencies are managed by
the host. Do not copy development node_modules into a Template archive.

This candidate is being qualified against the task's OpenClaw main checkout;
package version strings alone do not establish compatibility with every stable
release. No registry release or end-user readiness is claimed yet.

## Template hookup (after installation proof)

Declare the verified plugin package/version or its self-contained bundled path.
Grant its six actual native tool names. Remove the obsolete external MCP command
and HOPPER_GTFS_CONFIG requirement only when the replacement is wired. Do not
publish a fake ClawHub reference. Missing or blocked tools must be diagnosed as
such; do not blindly reinstall or weaken policy.

## Sources

- Catalog: https://files.mobilitydatabase.org/feeds_v2.csv
- Catalog schema: https://github.com/MobilityData/mobility-database-catalogs
- GTFS library: https://github.com/BlinkTagInc/node-gtfs
- Protobuf bindings: https://github.com/MobilityData/gtfs-realtime-bindings
- Original household use case: https://github.com/DonnieFi/bernie

No upstream gtfs-mcp implementation or private household records are bundled.
Review dependency and provider licenses before distribution/deployment.
