# Local photo AI

Wakefield uses Ollama's vision API to inspect actual image bytes and produce structured category, severity, department, accessibility and summary suggestions. The default is `qwen3-vl:2b-instruct`, a smaller vision model selected for this computer's integrated Intel graphics. The explicit instruction variant supplies direct classifications; the generic `2b` alias resolved to a reasoning variant during testing and exhausted its response budget without a final answer. It runs locally without cloud tokens or an EAiSER SDK.

## Start

From the repository folder:

```powershell
npm.cmd run setup:ai
.\scripts\run-wakefield.cmd
```

The first setup downloads the official Ollama Windows installer if needed, verifies its Ollama Inc. signing certificate, installs it in the current Windows account, and downloads the approximately 1.9 GB model. Ollama's runtime also needs disk space. Setup logs and the installer stay in the gitignored `.data/local-ai/` folder; model weights stay in Ollama's normal local model directory and are not pushed to GitHub. Subsequent launches reuse them. Setup does not change PowerShell execution policy or sign into a cloud service.

Open the **Local** address printed by Next.js; it may use port 3001 if 3000 is occupied. Wait for **Photo AI connected**. The launcher starts an installed Ollama service in the background if necessary. Keep the app's terminal running.

## Existing experience

The frontend layout, map, location picker, ranked queue, repair verification, impact points and rewards remain connected to the same report objects. Image inference is independent of the data adapter: browser-local reports can still use a real model through the same-origin Next.js endpoint.

- `POST /api/analyze`: accepts a JPEG/PNG/WebP photo in multipart field `image`, or a previously uploaded `photoId` for the connected backend.
- The server sends base64 image bytes to Ollama `/api/chat`, with a JSON output schema and temperature zero.
- The model classifies image contents. Gallery titles, file names, saved example labels and chosen map locations are not passed as visual evidence.
- The server validates categories and severity and routes the model's category consistently to a campus team. The suggested department is saved on the report; external dispatch is not connected.
- The reporter can edit suggestions before saving. A no-issue result requires an explicit manual review before a report can be created.
- Failed inference shows an error and a manual-review choice. It never silently substitutes a saved classification.
- The server reuses an analysis only for the exact same image bytes, model, provider address and prompt version. Reuse is labeled in the review. Restarting the app clears that in-memory cache.

## Photo groups

The gallery contains the original four photos and eight labeled AI-generated test scenes. **Presentation controls** can analyze the Library's three generated photos, Engineering's three generated photos, or all eight. The batch saves completed issue results into the existing queue, skips no-issue images and gallery photos already added, and can stop after the current photo. The original four-photo shortcut still uses saved labels and is labeled accordingly.

Generated scenes have suggested testing pins, not verified real-world addresses. The reporter can change the selected building or walkway. Classification and confidence are model suggestions and can be wrong; the confidence number is not a calibrated probability.

## Configuration

Server-only settings, illustrated in `.env.example`:

```text
ANALYSIS_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3-vl:2b-instruct
OLLAMA_TIMEOUT_MS=180000
```

Use `ANALYSIS_PROVIDER=manual` for explicit manual-only operation, or `eaiser` with a real configured server provider. Restart the app after changing server settings. The local launcher selects Ollama; `npm.cmd run dev` respects your configured provider. Never expose the Ollama service to the public internet. Deploying just the app to another computer does not move this computer's local model with it.

## Verify

```powershell
npm.cmd run ai:status
npm.cmd run test:vision -- --base=http://127.0.0.1:3001 --all
```

The integration check runs real inference on a clear-route image, a water/electrical hazard and a blocked ramp. It checks structured results and routing, renamed uploads, no-issue detection, invalid images and unrelated browser origins. `--all` also reviews the remaining five generated photos. It does not create reports or change campus activity.

References: [Ollama vision API](https://docs.ollama.com/capabilities/vision), [structured output schema](https://docs.ollama.com/capabilities/structured-outputs), [Qwen3-VL 2B instruction model](https://ollama.com/library/qwen3-vl:2b-instruct), [Windows setup](https://docs.ollama.com/windows).
