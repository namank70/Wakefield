# Progress

Phase 2 frontend on `frontend/phase-2`. Phase 1 remains on `frontend/phase-1`.

## Phase 2

- Campus health is the average of named campus buildings, so one damaged building cannot paint the whole campus red.
- A building bar appears on the map only while that building is below 100.
- Credits for reporting, confirming, verifying, and a demo redeem catalog.
- Student and University desks. University claim and mark-fixed restore health. A student can confirm the repair or send it back.
- Repeated reports step an issue up one severity band at the third report and sort it first on the fixing list.

## Done

- Next.js App Router app with TypeScript, Tailwind, Leaflet, Turf, and Lucide.
- `WakefieldClient` with a mock implementation and an isolated live client.
- OpenStreetMap buildings, paths, streets, entrances, bicycle parking, pilot footprints, and both boundaries, cached and attributed.
- `npm.cmd run validate:geo` passes for the four landmark relationships.
- Dark vector map, inverse mask, clamped pan and zoom, landmark search, fit, and recenter.
- Local reveal scoring in `src/lib/activation/reveal.ts`, separate from the layer paint.
- Camera, file fallback, location confirmation, mock analysis, duplicate suggestion, and submit.
- Issue drawer on desktop and bottom sheet on mobile. Submitting does not move the map.
- Demo controls, session photo previews, and `localStorage` reset.
- Browser pass: baseline linework, library signal, urgent signal, photo fallback, seeded pin, duplicate merge, view signal, and reset to zero open signals.
- `npm.cmd run lint` and `npm.cmd run build`.

## Not in this phase

- Real EAiSER calls, uploads to object storage, or responder actions.
- Wiring the map to live `getMapState`.
- A leaderboard, scan effects, or a claim that quiet means safe.
