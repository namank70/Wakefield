# Wakefield status

The integrated GitHub application is the Next.js app in this repository. Start it with `scripts/run-wakefield.cmd` on Windows or follow the root README.

## Integrated experience

- SJSU campus map with named building and walkway search, precise location selection, and selected-feature highlighting.
- Photo-led reporting with twelve gallery images, upload/camera support, local Ollama vision classification, and editable review before saving.
- A ranked priority queue that increases the weight of repeated, urgent, accessibility-impacting, and waiting reports.
- Student and University workflows for assignment, repair, and student verification, plus building health and impact points.
- A rewards catalog that deducts points and creates an in-app claim code.
- Responsive computer and phone layouts, local presentation controls, and a one-click Windows launcher.

## Connection boundaries

- The default presentation setup stores activity in the browser. It does not send reports to campus staff.
- Gallery and uploaded photos use the configured local vision model. The separate original four-photo shortcut explicitly uses saved labels. Eight generated scenes are labeled as test photos.
- EAiSER Studio and the GitHub application are separate. The Studio SDK image-analysis method has not been verified for this project.
- Reward codes are in-app claims; campus vendors are not connected to fulfill them.

See `docs/PRESENTATION_SCRIPT.md` for the ordered walkthrough and `docs/EAISER_INTEGRATION.md` for the provider setup status.
