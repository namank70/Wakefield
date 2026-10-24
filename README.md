# Wakefield

When the campus speaks, the campus wakes. This branch is the Phase 1 frontend: a bounded SJSU map, local progressive reveal, and a mock camera-to-report flow. No live model calls and no API keys.

## Setup (Windows)

Use `npm.cmd` and `npx.cmd`. Do not change the execution policy.

```powershell
npm.cmd install
copy .env.example .env.local
npm.cmd run dev
```

Open http://localhost:3000.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | `live` | `live` uses the integrated same-origin API. Set `mock` only for the offline demo. |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Shows the demo controls and the “Demo data” label. |
| `NEXT_PUBLIC_API_BASE_URL` | empty | Optional for `live`; empty uses the same-origin Next.js API. |

Phone camera tests need a secure context:

```powershell
npm.cmd run dev -- --experimental-https
```

Plain HTTP on a LAN address will not open the camera. The file-upload fallback works on HTTP.

## Checks

```powershell
npm.cmd run validate:geo
npm.cmd run lint
npm.cmd run build
```

`validate:geo` checks that MLK Library is northwest of Tower Hall, Engineering is north and east of the library, the Student Union is south of Engineering, and both boundaries parse.

## Map

The map is vector geometry on `#070B14`. There are no street or satellite tiles. Pan and zoom stay inside the movement boundary. Recenter fits the campus and does not request GPS. A new report does not move the camera; **View signal** does.

Geometry is cached under `src/data/geo` from OpenStreetMap (ODbL). See `src/data/geo/SOURCE.md` for the retrieval date and the street gaps that shaped the outer boundary. Refresh it with `node scripts/fetch-geo.mjs` when the cache in `scripts/.cache` is absent.

## Reporting

Report a signal opens the camera (`facingMode: environment`), with a labeled photo upload when the camera is denied or missing. Location is requested only on the confirm step. Pins outside the reporting boundary are rejected. Demo mode can drop a labeled pin on the south side of MLK Library.

Mock analysis is editable and marked `provider: "mock"`. A nearby unresolved report in the same category within 30 meters and 24 hours is offered as one existing signal, not a second pin. Report metadata is stored in `localStorage`. Photo previews stay in session memory and are not permanent.

## Demo controls

With `NEXT_PUBLIC_DEMO_MODE=true`, the panel can reset the map, add a Library signal, add a second identity, add a nearby distinct issue, trigger an urgent Engineering leak, or preview reveal levels without writing reports. Reset returns the quiet outline.

## Live adapter

Set `NEXT_PUBLIC_DATA_MODE=live` to use the integrated API. Leave `NEXT_PUBLIC_API_BASE_URL` empty for the same-origin routes, or set it when deploying the API separately. Feature components keep calling `getClient()` from `src/lib/api/index.ts`. The live module is the only place that fetches:

- `POST /api/uploads`
- `POST /api/analyze`
- `POST /api/duplicates/suggest` (not in the backend brief yet)
- `POST /api/reports`
- `GET /api/map-state?campusId=sjsu`
- `GET /api/issues/:issueId`

Phase 2 status updates and verification are not on this client. The map currently reads the local store, so a live deployment still needs that store wired to `getMapState` before pins come from the server.
