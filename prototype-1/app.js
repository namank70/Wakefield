// Campus Fix: a small EAiSER Campus flow on the EAiSER College SDK (window.EAiSER).
// The Studio preview runs in a sandbox without storage; the live adapter belongs in the API layer.
const $ = (id) => document.getElementById(id);
let campus = null;
let draft = null;
let currentAnalysis = null;

async function start() {
  const here = await EAiSER.campus.detect();
  campus = here.campus;
  $("campus").textContent = campus ? "You're at " + campus.name + "." : "You're off campus: reports go to the city.";
  if (campus) {
    const { buildings } = await EAiSER.campus.buildings(campus.id);
    if ($("building")) {
      for (const b of buildings) $("building").add(new Option(b.name, b.id));
      if (here.building) $("building").value = here.building.id;
    }
  }
  await renderList();
}

$("send").addEventListener("click", async () => {
  const button = $("send");
  button.disabled = true;
  try {
    await EAiSER.reports.send(draft.id, { university: $("to-university").checked, city: $("to-city").checked, landlord: $("to-landlord").checked });
    $("review").hidden = true;
    await renderList();
    currentAnalysis = null;
  } catch (err) {
    $("error").textContent = err.message;
  }
});

async function renderList() {
  const reports = (await EAiSER.reports.list()).filter((r) => r.sentAt);
  $("reports").innerHTML = "";
  for (const r of reports) {
    const li = document.createElement("li");
    const title = document.createElement("strong"), status = document.createElement("span");
    title.textContent = r.title;
    status.className = "status";
    status.textContent = r.timeline[r.timeline.length - 1].label;
    li.append(title, status);
    $("reports").appendChild(li);
  }
  if (!reports.length) $("reports").innerHTML = '<li class="muted">No reports yet.</li>';
}

start();
$("photo")?.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    $("error").textContent = "";
    $("initial-inputs").hidden = true;
    $("analysis-step").hidden = false;
    $("analysis-loading").hidden = false;
    $("analysis-results").hidden = true;

    setTimeout(() => {
      $("analysis-loading").hidden = true;
      $("analysis-results").hidden = false;

      const analysisResult = {
        category: "Bike and scooter parking",
        summary: "Bikes and scooters are blocking the pedestrian route",
        severity: "High",
        department: "Transportation and Parking Services",
        confidence: "92%",
        accessibilityImpact: "Yes",
        region: "MLK Library",
      };

      $("analysis-category").textContent = analysisResult.category;
      $("analysis-summary").textContent = analysisResult.summary;
      $("analysis-severity").textContent = analysisResult.severity;
      $("analysis-department").textContent = analysisResult.department;
      $("analysis-confidence").textContent = analysisResult.confidence;
      $("analysis-accessibility").textContent = analysisResult.accessibilityImpact;
      $("analysis-region").textContent = analysisResult.region;
      currentAnalysis = analysisResult;
    }, 1500);
  } else {
    $("analysis-step").hidden = true;
    $("initial-inputs").hidden = false;
  }
});

$("retake-photo")?.addEventListener("click", () => {
  $("photo").value = "";
  currentAnalysis = null;
  $("analysis-step").hidden = true;
  $("initial-inputs").hidden = false;
});

$("confirm-analysis")?.addEventListener("click", async () => {
  const button = $("confirm-analysis");
  button.disabled = true;
  $("error").textContent = "";
  try {
    draft = await EAiSER.reports.create({
      description: $("analysis-summary").textContent,
      photo: $("photo").files[0] ? await EAiSER.photo($("photo").files[0]) : undefined,
      location: { campus: campus && campus.id, building: $("building").value || undefined },
    });

    if (currentAnalysis) {
      $("review-title").textContent = currentAnalysis.category;
      $("review-summary").textContent = currentAnalysis.summary;
      $("review-severity").textContent = "Severity: " + currentAnalysis.severity;
      $("to-university").checked = draft.suggested.university;
      $("to-university").disabled = !draft.campus;
      $("to-university-label").textContent = currentAnalysis.department;
      $("to-city").checked = draft.suggested.city;
      $("to-city-label").textContent = draft.destinations.city;
      $("to-landlord").checked = draft.suggested.landlord;
      $("review-accessibility").textContent = "Accessibility impact: " + currentAnalysis.accessibilityImpact;
      $("review-accessibility").hidden = false;
      $("review-region").textContent = "Region: " + currentAnalysis.region;
      $("review-region").hidden = false;
    } else {
      $("review-title").textContent = draft.title;
      $("review-summary").textContent = draft.summary;
      $("review-severity").textContent = "Severity: " + draft.severity;
      $("to-university").checked = draft.suggested.university;
      $("to-university").disabled = !draft.campus;
      $("to-university-label").textContent = draft.destinations.university || "The university";
      $("to-city").checked = draft.suggested.city;
      $("to-city-label").textContent = draft.destinations.city;
      $("to-landlord").checked = draft.suggested.landlord;
      $("review-accessibility").hidden = true;
      $("review-region").hidden = true;
    }
    $("analysis-step").hidden = true;
    $("review").hidden = false;
    $("review-title").focus?.();
  } catch (err) {
    $("error").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

setInterval(renderList, 15000);
