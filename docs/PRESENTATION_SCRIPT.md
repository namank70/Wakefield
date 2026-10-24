# Wakefield presentation flow

## Start the app

From the repository folder, double-click `scripts/run-wakefield.cmd` or run it from PowerShell:

```powershell
.\scripts\run-wakefield.cmd
```

Run `npm.cmd run setup:ai` once to install the local vision model. Open the **Local** address printed by the launcher (for example `http://localhost:3001` if port 3000 is already occupied). Wait for **Photo AI connected**. For a clean start, expand **Presentation controls** and choose **Reset campus activity**. Reports, points and claims stay in this browser.

## Two-minute walkthrough

1. **Start with the map.** Say: “Wakefield turns individual campus reports into a shared signal, so teams can see where attention is building.”
2. **Show real image classification.** Choose **Report a signal** and the Library access-ramp photo. Confirm MLK Library or pick a walkway, then continue. The local model supplies category, severity and the receiving department. Point out its visible-evidence explanation, review the fields and save.
3. **Build two areas of concern.** Expand **Presentation controls**, run **Analyze Library photo set · 3**, then **Analyze Engineering photo set · 3**. Each image is processed by the model, and completed reports update building health and the map. Repeat images already saved are skipped. First inference can be slower while the model loads.
4. **Make priority the star.** Open **Priority queue** and compare severity, accessibility impact, report count and score. Report a second photo of the same kind nearby and attach it as evidence to increase its count. The original saved four-photo sequence is also available for the independent-confirmation shortcut: click the confirmation button twice to reach three reports and show the severity step-up.
5. **Check a clear route.** Choose **Clear route beside bike racks** from the Student Union photo filter. The expected result is no issue; show that the app asks for review instead of automatically filling the queue. These images are labeled synthetic test scenes.
6. **Close the response loop.** Switch to **University**, open the top-priority signal, choose **Claim**, then **Mark fixed**. Switch back to **Student** and verify the repair. The issue leaves the active queue and building health recovers.
7. **Finish with rewards.** Open the points balance and claim a coffee, snack, print, or parking reward. The balance is deducted and a unique in-app claim code appears in **Your claimed rewards**.

## Prepared photo order and locations

These files are already included in the app. Use the four prepared-photo cards in this order, or select **Upload a photo instead** and choose the matching file. The locations are editable before a report is saved.

1. `fusedLight.jpeg` — **MLK Library**, interior route; lighting.
2. `chairsScattered.jpeg` — **Student Union**, classroom aisle; walkway/accessibility review.
3. `brokenchair.jpeg` — **Engineering**; damaged furniture.
4. `bikeRACK.jpeg` — **Student Union**; possible bike/scooter encroachment. For the route-highlight moment, change the location to **Paseo de San Antonio** before continuing.

## Accurate connection notes

The gallery and uploaded photos use the configured local vision model. The original four-photo shortcut is clearly labeled as saved classifications. AI-generated scenes are for testing and do not document actual SJSU incidents; their map pins are selected by the reporter. AI confidence is an estimate and classifications remain editable. Reports and points stay in this browser in the default setup. Reward codes are in-app claims; campus providers are not connected to fulfill them. This local AI connection is independent of EAiSER Studio.

See `docs/TEST_PHOTOS.md` for the eight additional images and their suggested locations.
