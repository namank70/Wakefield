# Wakefield integration contracts

These contracts are the boundary between the backend workflow and the Wakefield intelligence module. JSON uses `latitude`/`longitude` for inputs, while GeoJSON polygon coordinates remain `[longitude, latitude]`.

## `locateRegion`

Input:

```json
{"latitude": 37.335, "longitude": -121.8817, "source": "student_confirmed_pin"}
```

Output:

```json
{"within_campus": true, "region_id": "MLK_LIBRARY", "region_name": "MLK Library", "location_source": "student_confirmed_pin", "reason": null}
```

`source` is `device_gps` or `student_confirmed_pin`. Invalid coordinates are errors; valid campus points outside the three pilot polygons return `region_id: null` rather than being assigned to the nearest building.

## `suggestDuplicate`

Input:

```json
{"category": "blocked_pathway", "latitude": 37.3351, "longitude": -121.8817, "now": "2026-01-01T12:00:00Z"}
```

Output when a match exists:

```json
{"existing_issue_id": "ISSUE-001", "distance_meters": 12.4, "category": "blocked_pathway", "requires_confirmation": true}
```

Only the same category, unresolved status (`open`, `in_progress`, `awaiting_verification`), distance at most 30m, and age strictly less than 24h qualify. The service never merges automatically.

## `calculateActivation`

Output:

```json
{"region_id": "MLK_LIBRARY", "activation_score": 6, "threshold": 5, "active": true, "recovered": false, "activation_reasons": ["demo_baseline:+1", "ISSUE-001:severity:+3", "ISSUE-001:accessibility:+2"]}
```

The score counts each unresolved unique issue once. Urgent issues activate immediately. `recovered` means the region activated historically and is no longer active.

## `calculateImpact`

Output:

```json
{"issue_id": "ISSUE-001", "priority_score": 59, "breakdown": {"severity": 30, "reports": 4, "accessibility": 15, "unresolved_time": 0, "critical_route": 10}}
```

The final score is clamped to 0–100; report, time, and severity components are independently bounded by the specification.

## `applyIssueDamage`

Output:

```json
{"region_id": "MLK_LIBRARY", "health": 70, "issue_id": "ISSUE-001", "applied_damage": 30}
```

Damage is stored on the unique issue and repeated calls are idempotent. Health is derived as `max(0, 100 - sum(damage of unresolved issues))`; `awaiting_verification` remains unresolved.

## `applyVerifiedHeal`

Input: `{"issue_id": "ISSUE-001"}`

Output:

```json
{"region_id": "MLK_LIBRARY", "health": 100, "issue_id": "ISSUE-001", "applied_damage": 30}
```

The issue must be `awaiting_verification`; successful verification changes it to `resolved`, records a recovery event, recalculates activation, and restores only that issue's damage. Failed verification uses `verify_repair(issue_id, false)`, reopens the issue, and does not heal.

## Persistence assumptions

The in-memory repository is deterministic test/demo storage. A production adapter must persist regions, issues, reports, issue location, status transitions, `applied_damage`, activation history, recovery events, and idempotency keys for credits and damage. The adapter should use a transaction or compare-and-set operation around first-time damage application and verification. External upload, EAiSER, realtime, and frontend concerns are intentionally outside this package.
