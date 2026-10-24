# Studio handoff

## Which version is which

- The GitHub repository is the main Wakefield application. It is a Next.js app with a campus map, photo-based reporting flow, location highlighting, ranked priority queue, response workflow, and points/rewards.
- EAiSER Studio is a separate environment. Pasting files into its Code tab does not connect it to GitHub, and Studio's **Go live** publishes the Studio version only. The Studio prototype is not the Next.js application or its API.

The EAiSER image-analysis method and a live report-submission method have not been verified in this Studio project. Earlier attempts to call `EAiSER.image.analyze(file)` failed at runtime because that namespace was unavailable. Do not describe a local suggestion as EAiSER analysis or claim a report reached campus staff unless the Studio tools confirm both operations.

## Optional Studio file handoff

`prototype-1/studio-handoff/` contains a separate static campus-map prototype. It is not required to run the GitHub app. Before using it, verify that its file set and Studio runtime match the current project; the Studio preview is independent from the Next.js app.

To run the GitHub application, use the repository's `scripts/run-wakefield.cmd` launcher, or follow the setup in the root README. To use Studio for judging, import a Studio-compatible version there and test its own preview. A Go Live link does not automatically publish later GitHub changes, and a GitHub push does not update the Studio draft.

## Integration status

The GitHub app's default local workspace stores report activity and impact points in the browser. Its Next.js server now connects to a local Ollama vision model for automatic category, severity and department suggestions; see `docs/LOCAL_AI.md` for setup. The model is independent of Studio and does not move with pasted static files. Reward claims deduct points and issue an in-app claim code; campus vendors are not connected to fulfill them.
