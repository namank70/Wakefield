# Decisions

## Scope

The newer brief wins where it disagrees with the older frontend brief. Reveal is local to an issue. `region.active` in the report response stays in the shared contract and does not paint a whole region. Phase 2 on `frontend/phase-2` adds campus and building health, impact credits, a university fixing list, student verification, and a demo redeem catalog. There is still no leaderboard, padlock, or scan-line.

## Client

Components call `getClient()`. `NEXT_PUBLIC_DATA_MODE=mock` is the default. The live module documents `POST /api/uploads`, `POST /api/analyze`, `POST /api/reports`, `GET /api/map-state?campusId=sjsu`, `GET /api/issues/:issueId`, and `POST /api/duplicates/suggest`. The duplicate route is not in the backend brief; the expected body is `DuplicateInput`. `updateIssueStatus` and `verifyIssue` are on the client. Mock mode writes the local store. Live mode calls `PATCH /api/issues/:issueId/status` and `POST /api/issues/:issueId/verify`.

A confirmed duplicate adds a report and evidence to the existing issue. It does not add a pin. Mock duplicate rule: same category, within 30 meters, unresolved, and an existing report newer than 24 hours.

`region.active` is true when that pilot region’s highest local score is at least 5 or it has an open urgent issue.

## Reveal

Scoring lives in `RevealResolver`. Weights are low 1, medium 2, high 3. Urgent forces level 4. Bands are 0 / 1–2 / 3–5 / 6–9 / 10+. Accessibility impact floors affected local features at level 3. Extra independent identities add at most +2 on that issue. These are prototype rules, not campus policy.

Category radii live in `src/lib/config/display.ts`. A printer issue highlights its building only. A blocked path highlights nearby paths. Zoom may cluster non-urgent markers below zoom 17 and hides photo previews below zoom 18. Zoom never raises the reveal level. Urgent issues stay visible at every zoom.

Quiet means few recent reports. It does not mean a place is verified safe.

## Geography

Retrieved 2026-10-24 from OpenStreetMap via Overpass, ODbL. The app reads `src/data/geo` only.

The OSM “Main Campus” polygon is not the reporting boundary. It extends east of 10th Street. The reporting polygon uses the intersections of East San Fernando, East San Salvador, South 4th, and South 10th. Pilot regions are the Library, Engineering, and Student Union footprints.

The movement ring is the next through-streets, configured from the measured corners in `src/data/geo/bounds.ts`. It is not a meter buffer. Downtown San Jose’s grid is diagonal. Recorded gaps:

- South 11th and East Santa Clara do not share a node (about 34 m). The northeast corner is the midpoint of that gap.
- Named 11th ends at San Salvador. Named William ends near 10th, about 213 m from 11th. The southeast edge follows those mapped ends.
- Named 3rd ends at San Salvador. William’s west end lies on the 3rd bearing one block south.

Buildings and paths are clipped to the reporting boundary so the one-block margin stays dark. Entrances and bicycle parking are imported only where OSM had them. Accessible routes were not in the extract and are omitted. Mapped data is not labeled as a verified safe route.

## Storage

Mock report metadata persists in `localStorage` under `wakefield.mock.v1`. Image blob URLs live in a session `Map` and are dropped on reset or reload. The UI says that mock storage is not permanent.

## Fonts and color

Space Grotesk for headings, Source Sans 3 for body, IBM Plex Mono for metadata. State uses a label or stroke as well as color: cyan signal, violet emerging, amber active, red urgent.
