# EAiSER Studio handoff

The repository and EAiSER Studio have different responsibilities:

- The Next.js app is the GitHub source of truth for the campus map, reporting flow, backend routes, persistence, spatial rules, and gamification.
- The `prototype-1/` files are the Studio handoff. They use the built-in `window.EAiSER` SDK and are the version to paste into the Studio Code tab for the real EAiSER analysis demo.

## Studio steps

1. Open the project in EAiSER Studio and open the Prototype Code tab.
2. Copy `prototype-1/index.html`, `prototype-1/app.js`, and `prototype-1/styles.css` into the matching Studio files.
3. Confirm the page loads in Preview.
4. Ask Marco: `Connect the photo analysis step to the built-in EAiSER engine using EAiSER.image.analyze(file), while preserving the confirmation and report flow.`
5. Test the photo flow: select a bike-rack image, wait for analysis, confirm, review, and send the report.
6. Use Studio's Go live version for the EAiSER-powered judging demo.

The standalone Next.js app remains runnable without Studio. Its `/api/analyze` route uses a configured `EAISER_API_URL` when one exists and otherwise returns the deterministic cached demo result. It never claims that cached output is a live EAiSER response.

## Why both versions exist

The Studio SDK is available only inside the Studio sandbox; it is not an external npm package or public API key. Keeping the Studio handoff separate lets the GitHub project remain reproducible while still demonstrating the genuine built-in EAiSER integration during evaluation.
