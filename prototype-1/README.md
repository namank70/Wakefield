# Campus Fix prototype

This folder contains the clickable prototype exported from MomentumAI Studio.

## Files

- `index.html` — report, analysis, review, and report-list screens
- `app.js` — EAiSER College SDK flow and the deterministic bike/scooter analysis demo
- `styles.css` — responsive dark Wakefield visual styling

## Important

The Studio version uses `window.EAiSER` and runs inside the EAiSER College sandbox. The hardcoded analysis result is for the repeatable hackathon demo. The production EaiSER adapter belongs behind Wakefield's server-side `/api/analyze` boundary and must not expose credentials in the browser.
