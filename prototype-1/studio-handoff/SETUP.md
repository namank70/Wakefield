# Optional Wakefield Studio files

The Studio preview uses the files in this folder. It is a static web prototype, not the Next.js app; the visible map geometry was generated from this repository's campus GeoJSON.

## 1. Put the project files into Prototype

In Prototype → Code, keep the existing `index.html`, `app.js`, and `styles.css` names. Add one new root-level file named `campus-map.svg`. Do not paste this handoff into `package.json` or `page.tsx`; the Studio page references only these three web files and the SVG map asset.

The map SVG is optimized to stay below Studio's 200 KB per-file limit.

From PowerShell opened at the repository root, run the first clipboard command, then click the new `campus-map.svg` editor in Studio and press Ctrl+A, Ctrl+V. Wait for Studio to show **Saved**:

```powershell
Get-Content -Raw -Encoding utf8 ".\prototype-1\studio-handoff\campus-map.svg" | Set-Clipboard
```

Then repeat this pattern for the three existing files: run one command, click its matching Studio editor, press Ctrl+A, Ctrl+V, and wait for **Saved** before continuing.

```powershell
Get-Content -Raw -Encoding utf8 ".\prototype-1\studio-handoff\index.html" | Set-Clipboard
```

```powershell
Get-Content -Raw -Encoding utf8 ".\prototype-1\studio-handoff\styles.css" | Set-Clipboard
```

```powershell
Get-Content -Raw -Encoding utf8 ".\prototype-1\studio-handoff\app.js" | Set-Clipboard
```

Run only one command before each paste, because each command replaces the clipboard contents. Wait for Studio to show **Saved** after each paste.

## 2. What this Studio version does

This is a separate static browser experience. It lets a user choose a campus location, attach an image, add a note, review a local starting suggestion, and save a report in that browser. The suggestion uses the file name and selected location; it does not inspect image contents. The static handoff does not include the GitHub app's ranked queue, building-health, repair-verification, or rewards workflows. It does not call EAiSER or dispatch reports to campus staff. Use the GitHub Next.js application for the complete integrated experience.

## 3. Preview and publish

In Prototype → Preview, test location selection, the photo review, and saving a report. The saved report should appear in **Your reports** and remain in the same browser. Studio's **Go live** publishes this static Studio version only. It does not publish the GitHub app, connect the versions, or turn local saves into campus dispatch. Only claim an EAiSER analysis or external report delivery after verifying that exact behavior in Studio at runtime.
