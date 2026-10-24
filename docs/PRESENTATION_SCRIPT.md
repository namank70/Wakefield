# Wakefield presentation flow

## Start the app

From the repository folder, double-click `scripts/run-wakefield.cmd` or run it from PowerShell:

```powershell
.\scripts\run-wakefield.cmd
```

Open `http://localhost:3000`. For a clean start, expand **Presentation controls** in the campus pulse card and choose **Reset campus activity**. The prepared report sequence, points, and claims are stored locally in the browser.

## Two-minute walkthrough

1. **Start with the map.** Say: “Wakefield turns individual campus reports into a shared signal, so teams can see where attention is building.”
2. **Activate the map.** Expand **Presentation controls** and select **Add the four-photo sequence**. Point out the separate Library, Student Union, and Engineering signals and their building/path effects.
3. **Make priority the star.** Select **Add an independent confirmation** twice. The Student Union access report moves up the queue as its count grows; at three reports its severity steps up as well. Open **Priority queue** and compare the score, urgency, accessibility flag, and number of reports.
4. **Show precise location selection.** Choose **Report a signal**, pick or upload a picture, continue to location, and select a named building or walkway. The map flies to it and outlines the selected footprint/route in cyan. Move the pin if the exact spot is a little different; the photo itself does not determine location.
5. **Close the response loop.** Switch to **University**, open the top-priority signal, choose **Claim**, then **Mark fixed**. Switch back to **Student** and verify the repair. The issue leaves the active queue and building health recovers.
6. **Finish with rewards.** Open the points balance and claim a coffee, snack, print, or parking reward. The balance is deducted and a unique in-app claim code appears in **Your claimed rewards**.

## Prepared photo order and locations

These files are already included in the app. Use the four prepared-photo cards in this order, or select **Upload a photo instead** and choose the matching file. The locations are editable before a report is saved.

1. `fusedLight.jpeg` — **MLK Library**, interior route; lighting.
2. `chairsScattered.jpeg` — **Student Union**, classroom aisle; walkway/accessibility review.
3. `brokenchair.jpeg` — **Engineering**; damaged furniture.
4. `bikeRACK.jpeg` — **Student Union**; possible bike/scooter encroachment. For the route-highlight moment, change the location to **Paseo de San Antonio** before continuing.

## Accurate connection notes

Prepared photos use saved classifications; other uploaded photos are attached for manual review and are not analyzed by image AI unless a provider is configured. The location is selected or moved by the reporter, not inferred from the picture. Reports and points in the default local setup stay in that browser. Reward claiming generates a Wakefield code, but campus café and parking providers are not connected to redeem it externally. The EAiSER Studio image-analysis SDK call previously failed at runtime in this project, so do not present a saved classification as live EAiSER analysis.
