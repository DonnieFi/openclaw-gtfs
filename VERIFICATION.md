# Development candidate verification

This is source/package evidence for an unpublished candidate, not a public release.

## Passed so far

- TypeScript checking against the task's current OpenClaw public SDK sources.
- The initial six focused tests (expanded to 14 after review): catalog associations/auth/status; canceled/skipped/stale
  predictions; absolute timestamps across midnight; vehicle route/speed handling;
  agent-scoped selection with failed-setup preservation; invalid/traversal ZIP refusal.
- Real public MobilityData export search for Halifax, schedule import, system
  selection, stop lookup, fresh departures, and vehicle queries through the plugin
  service and its actual worker. That first backend test used a synthetic state adapter.
- Native OpenClaw npm-pack installation into a fresh, task-owned state root after
  normal local-source and capability consent. Runtime dependencies were installed
  into the host-managed plugin npm project, not borrowed from development modules.
- Native runtime inspection: plugin loaded, all six native tools registered,
  all six direct dependencies present, no runtime inspection diagnostics.
- Actual disposable Gateway HTTP tools/invoke calls, authenticated with a synthetic
  task-owned token: read initially unconfigured system, select Halifax, search
  stops, obtain three realtime departures from stop 8336. This exercised the
  plugin's production guarded HTTP, real static worker and native keyed state store.
  The Gateway and its owned listener were stopped afterward.
- Cold Gateway restart retained the selected Halifax system through native plugin
  state. Actual catalog-search and route-filtered vehicle tools then succeeded
  through the Gateway endpoint; the restarted listener also closed cleanly.

Live observations were on 2026-11-12. They are historical evidence, not current
travel advice. Native proof used a task-local verified Node 24.22.1 launcher and
OpenClaw's pinned runtime. Initial pure unit tests also ran on the sandbox's older
Node 24.20.0; that alone was not accepted as supported-host proof.

## Partial or not yet qualified

A separate fresh Template fixture with a bundled plugin passed native Add preview:
zero blockers, no external MCP command/env requirement, readiness true. Applying
it retained the new agent but stopped at model authentication before plugin setup:
no route-compatible OpenAI authentication source was configured in that isolated
state. The agent was not duplicated or reset to hide this failure. Full Template
Add plus a genuine model conversation is NOT proven.

The installer reports advisory compatibility findings in transitive dependencies
(including code-generation and global-patch patterns). They were not disabled or
suppressed. Runtime load and the observed tool calls passed; this does not establish
compatibility on every platform or compiled host.

No model inference, production Gateway mutation, publication, GitHub push, or
showcase post has been performed. No real user's location or transit selection was
used. Credentials in the disposable fixture were synthetic and are not packaged.

Independent review findings have been resolved with regression tests.
Final artifact checks are complete. Pending:
receiving-host model conversation and complete Template Add, broader-feed testing,
and the optional next-stage features intentionally omitted from this candidate.

## Independent review repairs (0.1.0-dev.2)

A separate read-only reviewer identified six issues. Each received a regression:
newer cancellation versus older endpoint prediction; repeated visits to one stop;
malformed catalog URLs; invocation currency at worker admission; waiting for
parallel fetch cleanup; and evaluating feed health after all downloads settle.
The six regressions failed against the previous implementation and passed after
the fixes. The worker admission negative control was corrected to use the original
call signature so its red result exercised an incorrectly started database worker,
not a test API mismatch.

An additional protocol test checks optional protobuf field presence (unknown speed,
bearing and stop sequence), arrival-time fallback, and explicit differential-feed
refusal. All 13 tests pass on supported Node 24.22.1. These are bounded correctness
checks, not worldwide transit accuracy certification.

## Live-feed identity repair (0.1.0-dev.3)

The final live replay exposed a Halifax trip published twice: one descriptor omitted
startTime while another supplied it. Both had the same trip ID and service date.
A production-service regression reproduced the duplicate departures. Normalization
now fills that omission only when exactly one explicit start time exists for the
trip/date; distinct frequency-service starts remain separate and ambiguous omitted
instances are not guessed. The regression is green; 14 total tests pass.

## Final artifact receipt

Version 0.1.0-dev.3 was installed through the native package installer and replayed
through a disposable Gateway's real tool endpoint. Selection, stop lookup and
three fresh Halifax departures passed; the formerly duplicated trip appeared
once. The process and owned listener were shut down afterward. This is tool-path
proof, not model inference. Strict typecheck and all 14 tests passed.

Artifact SHA-256: c51cbc87d5f94e382940be0044b412da539a6abb9323943174f6507c58e98c7d
Artifact contains 13 files, including emitted entry/worker JavaScript and runtime
dependency declarations, with no node_modules, credentials or transit databases.
The earlier bundled Template preview/partial Add used 0.1.0-dev.1; its unchanged
packaging shape is supporting evidence, not a successful final-version Add claim.
