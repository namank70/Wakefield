# Wakefield

When the campus speaks, the campus wakes. Wakefield turns photo-led reports into a campus-wide priority queue, an adaptive map, building health, a repair-and-verification loop, and impact rewards. This is the full Next.js application in the GitHub repository; the optional Studio prototype is a separate static handoff.

## Setup (Windows)

Use `npm.cmd` and `npx.cmd`. Do not change the execution policy. For a one-click Windows start, run `scripts\run-wakefield.cmd`.

For automatic photo classification, run `npm.cmd run setup:ai` once first. This installs Ollama from its official signed Windows installer when needed and downloads the local `qwen3-vl:2b-instruct` vision model. Later launches reuse the installed model. The app's photo AI status shows when it is ready. See [docs/LOCAL_AI.md](docs/LOCAL_AI.md).

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

Report a signal offers twelve campus photos, device upload, and the camera. Eight additional images are AI-generated test scenes stored beside the original four in `public/demo/`; the gallery labels their origin and filters them by area. Photos selected from the gallery and device uploads both go through the configured image provider. The local Ollama model inspects image contents and suggests category, severity, summary, department, and accessibility impact, with a short visible-evidence explanation. Clear photos can return no issue; they do not automatically create a report. If the model is unavailable, the reporter can retry or explicitly review manually.

Choose a building or walkway from the location list, and the map flies to and highlights that feature. Move the pin to the exact spot if needed; location is not inferred from the image. Review the AI suggestions before saving. Pins outside the campus reporting boundary are rejected.

The campus pulse can analyze the Library's three generated photos, Engineering's three generated photos, or all eight in sequence. Only completed AI classifications that identify an issue create reports. Clear photos and previously added gallery photos are skipped. The original four-photo shortcut remains available and explicitly uses saved labels. Every open signal receives a priority score based on severity, repeat reports, accessibility impact, response status, and time waiting. Duplicate reports increment its count, raise its place in both queues, and step severity up when a third report arrives. An urgent issue activates immediately. Additional reporters increase the regional activation score without applying building damage twice. Marking an issue fixed keeps damage in place until a student verifies the repair; verification restores health and leaves a green recovered footprint on the map.

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
