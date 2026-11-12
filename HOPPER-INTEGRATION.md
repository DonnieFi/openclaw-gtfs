# Hopper hookup contract

Plugin id: hopper-gtfs. Local package: hopper-gtfs-plugin, version 0.1.0-dev.3.
There is no published ClawHub coordinate yet. Do not invent one.

## Native tools

- search_transit_systems({ query, limit? }): public catalog candidates, source and
  capabilities/auth metadata. A listing is not a health claim.
- use_transit_system({ system_id }): after user confirmation, validate schedule
  and available trip updates, then save the public system choice for this agent.
- get_transit_system({}): configured system or null; built-in Halifax ID mdb-734.
- search_transit_stops({ query, limit? }): exact public ID/name search.
- get_transit_departures({ stop_id, route_id?, limit? }): predicted departures
  with ISO timestamps, trip headsign, stop sequence, feed age and agency timezone.
- get_transit_vehicles({ route_id?, limit? }): public vehicle locations only.

Grant these actual names through the ordinary tool policy. They are native tools,
not hopper-transit__* MCP aliases. A minimal profile needs explicit allowances.
Do not grant unrestricted tools or shell execution to compensate for missing ones.

## Source integration

Keep one plugin source owner. Build first, then place the eligible distributable
files (package.json, openclaw.plugin.json, dist/, README, LICENSE) in Hopper's
self-contained plugins/gtfs folder, or use a verified pinned registry dependency
once published. Do not copy node_modules, test state, provider credentials, data
caches, or the entire source repository into the Template.

For bundled delivery, CLAW.md declares:

    plugins:
      - path: plugins/gtfs

Remove the old external mcpServers.hopper-transit declaration and its
HOPPER_GTFS_CONFIG requirement. Remove obsolete MCP-only tool grants; add the six
native names. Keep the workflow skill, but adapt its arguments to the actual tool
schemas above. Omit automations when there are no schedules.

## Existing Hopper agents

Template Add is a one-way apply, not a live update link. Installing the plugin
does not rewrite an already-created Hopper agent's old MCP tool grants or skill
instructions. Reconcile those through the receiving host's ordinary authorized
agent controls; do not repeatedly Add another agent to repair the original.
Do not call the retired MCP-only get_alerts/list_routes tools: they are not among
this candidate's six native tools.

## First-run flow

1. Check visible tools. If missing, distinguish disabled/filtered tools from an
   absent plugin; use normal install/consent controls and only real links.
2. Read current system. Reuse it if appropriate; don't repeatedly reconfigure.
3. Search a city/agency and show choices with location and coverage. For Halifax,
   mdb-734 is an included public preset; it does not require a catalog lookup first.
4. Get user confirmation before use_transit_system, because the selection applies
   across this agent's sessions. Query one stop and obtain real departures.
5. Leave schedules, person tracking and persistent private commute records out.

## Proof status

Native package installation, dependency resolution, loading and tool invocation
were tested on a disposable Gateway. A fresh bundled Template Add preview passed,
but apply stopped before dependency setup because that isolated state lacked model
credentials. Full fresh Template Add/model conversation remains a required pilot
check; do not relabel the package-install proof as that result.

All installs need normal source/capability consent. The plugin is development
software, not a production-readiness or worldwide-transit-coverage promise.
