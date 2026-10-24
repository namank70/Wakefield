# Wakefield

When the campus speaks, the campus wakes. Wakefield turns photo-led reports into a campus-wide priority queue, an adaptive map, building health, a repair-and-verification loop, and impact rewards. This is the full Next.js application in the GitHub repository; the optional Studio prototype is a separate static handoff.

## Setup (Windows)

Use `npm.cmd` and `npx.cmd`. Do not change the execution policy. For a one-click Windows start, run `scripts\run-wakefield.cmd`.

```powershell
npm.cmd install
copy .env.example .env.local
npm.cmd run dev
```

Open http://localhost:3000.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | `mock` | `mock` keeps report state in this browser. `live` routes through the same-origin Next.js API. |
| `NEXT_PUBLIC_GUIDED_MODE` | `true` | Shows the campus pulse and prepared photo sequence controls. |
| `NEXT_PUBLIC_API_BASE_URL` | empty | Optional for `live`; empty uses the same-origin Next.js API. |

The old `NEXT_PUBLIC_DEMO_MODE` setting remains accepted for existing local `.env.local` files.

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

Report a signal offers four prepared campus photos, device upload, and the camera. Prepared photos use saved classifications. Other uploads are attached to the report and start with a manual-review form; they are not described as image analysis unless a live EAiSER provider is configured. Choose a building or walkway from the location list, and the map flies to and highlights that feature. Move the pin to the exact spot if needed; location is not inferred from the image. Category, severity, summary, department, and accessibility impact can be reviewed before saving. Pins outside the campus reporting boundary are rejected.

The campus pulse can load all four photo-backed reports at once, add independent confirmations, or reset activity. Every open signal receives a priority score based on severity, repeat reports, accessibility impact, response status, and time waiting. Duplicate reports increment its count, raise its place in both queues, and step severity up when a third report arrives. An urgent issue activates immediately. Additional reporters increase the regional activation score without applying building damage twice. Marking an issue fixed keeps damage in place until a student verifies the repair; verification restores health and leaves a green recovered footprint on the map.

## Presentation flow and rewards

See [docs/PRESENTATION_SCRIPT.md](docs/PRESENTATION_SCRIPT.md) for the ordered picture/location walkthrough and presenter cues.

Reports and points in the default local setup are stored in this browser. Redeeming deducts points and generates a unique Wakefield claim code. The code is currently an in-app claim; campus café and parking providers are not connected to fulfill it externally.

## Live adapter

Set `NEXT_PUBLIC_DATA_MODE=live` to use the same-origin API routes. Leave `NEXT_PUBLIC_API_BASE_URL` empty for the same-origin routes, or set it when deploying the API separately. EAiSER credentials remain server-only. Feature components call `getClient()` from `src/lib/api/index.ts`; the live module handles:

- `POST /api/uploads`
- `POST /api/analyze`
- `POST /api/duplicates/suggest` (not in the backend brief yet)
- `POST /api/reports`
- `GET /api/map-state?campusId=sjsu`
- `GET /api/issues/:issueId`

Status updates and repair verification use integrated routes. The local backend persists state under the gitignored `data/` directory. See [docs/STUDIO_HANDOFF.md](docs/STUDIO_HANDOFF.md) for the separate static Studio workflow and its integration limitations.
