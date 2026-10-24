// This legacy static handoff is intentionally local-only; the main application is in the repository root.
const $ = (id) => document.getElementById(id);
const reportStorageKey = "wakefield-studio-reports";
let currentAnalysis = null;

const categoryRules = [
  { pattern: /bike|bicycle|scooter|rack/i, category: "bike_scooter_parking", severity: "medium", department: "Transportation and Parking Services", access: false, summary: "Possible bicycle or scooter parking issue. Review the photo and confirm the route is clear." },
  { pattern: /ramp|wheelchair|accessibility|curb/i, category: "accessibility_barrier", severity: "high", department: "Accessibility and Facilities", access: true, summary: "Possible accessibility barrier. Please review the photo and confirm the route impact." },
  { pattern: /flood|fire|injur|urgent/i, category: "water_leak", severity: "urgent", department: "Facilities Plumbing", access: false, summary: "Possible urgent campus issue. Review the photo and contact emergency services if someone is in immediate danger." },
  { pattern: /water|leak|pipe/i, category: "water_leak", severity: "high", department: "Facilities Plumbing", access: false, summary: "Possible water issue. Review the photo and confirm the details." },
  { pattern: /light|lamp|dark/i, category: "lighting", severity: "medium", department: "Facilities Electrical", access: false, summary: "Possible lighting issue. Review the photo and confirm the details." },
];

function getReports() {
  try { return JSON.parse(localStorage.getItem(reportStorageKey) || "[]"); }
  catch { return []; }
}
function renderList() {
  const reports = getReports();
  const list = $("reports");
  list.replaceChildren();
  reports.forEach((report) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const status = document.createElement("span");
    title.textContent = report.title;
    status.className = "status";
    status.textContent = `Saved locally · ${report.location}`;
    item.append(title, status);
    list.append(item);
  });
  if (!reports.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No saved reports yet.";
    list.append(empty);
  }
  $("campus").textContent = `SJSU CAMPUS · ${reports.length} SAVED REPORT${reports.length === 1 ? "" : "S"} · LOCAL WORKSPACE`;
}
function suggestFromFile(file, location) {
  const match = categoryRules.find((rule) => rule.pattern.test(file.name));
  const selected = match || {
    category: "walkway_obstruction", severity: "medium", department: "Facilities", access: false,
    summary: "Possible campus maintenance issue. Review the photo, edit the details, and confirm before saving.",
  };
  return { ...selected, region: location || "MLK Library", provider: "local" };
}
function titleCase(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function showAnalysis(result) {
  $("analysis-loading").hidden = true;
  $("analysis-results").hidden = false;
  $("analysis-provider").textContent = "Editable local suggestion from the file name · not photo analysis";
  $("analysis-category").textContent = titleCase(result.category);
  $("analysis-summary").textContent = result.summary;
  $("analysis-severity").textContent = titleCase(result.severity);
  $("analysis-department").textContent = result.department;
  $("analysis-confidence").textContent = "Not scored";
  $("analysis-accessibility").textContent = result.access ? "Review recommended" : "Not identified by this local suggestion";
  $("analysis-region").textContent = result.region;
  currentAnalysis = result;
}

$("building").addEventListener("change", () => {
  const selected = $("building").selectedOptions[0]?.textContent;
  if (selected) $("campus").textContent = `SJSU CAMPUS · LOCATION SELECTED: ${selected.toUpperCase()}`;
});
$("photo").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    $("error").textContent = "Choose an image file to continue.";
    return;
  }
  $("error").textContent = "";
  $("analysis-step").hidden = false;
  $("analysis-loading").hidden = false;
  $("analysis-results").hidden = true;
  const location = $("building").selectedOptions[0]?.textContent || "MLK Library";
  window.setTimeout(() => showAnalysis(suggestFromFile(file, location)), 200);
});
$("retake-photo").addEventListener("click", () => {
  $("photo").value = "";
  currentAnalysis = null;
  $("analysis-step").hidden = true;
});
$("confirm-analysis").addEventListener("click", () => {
  if (!currentAnalysis) return;
  $("review-title").textContent = titleCase(currentAnalysis.category);
  $("review-summary").textContent = currentAnalysis.summary;
  $("review-severity").textContent = `Suggested priority: ${titleCase(currentAnalysis.severity)}`;
  $("to-university").checked = true;
  $("to-university-label").textContent = currentAnalysis.department;
  $("to-city").checked = false;
  $("to-landlord").checked = false;
  $("review-accessibility").textContent = `Accessibility review: ${currentAnalysis.access ? "recommended" : "not identified"}`;
  $("review-accessibility").hidden = false;
  $("review-region").textContent = `Location: ${currentAnalysis.region}`;
  $("review-region").hidden = false;
  $("analysis-step").hidden = true;
  $("review").hidden = false;
});
$("send").addEventListener("click", () => {
  if (!currentAnalysis) return;
  const selectedRecipients = [
    $("to-university").checked ? $("to-university-label").textContent : null,
    $("to-city").checked ? $("to-city-label").textContent : null,
    $("to-landlord").checked ? "Your landlord" : null,
  ].filter(Boolean);
  if (!selectedRecipients.length) {
    $("error").textContent = "Choose a suggested recipient before saving.";
    return;
  }
  const report = {
    id: `signal-${Date.now()}`,
    title: titleCase(currentAnalysis.category),
    summary: currentAnalysis.summary,
    severity: currentAnalysis.severity,
    department: currentAnalysis.department,
    location: currentAnalysis.region,
    recipients: selectedRecipients,
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(reportStorageKey, JSON.stringify([report, ...getReports()]));
    $("error").textContent = "";
    $("review").hidden = true;
    $("photo").value = "";
    $("initial-inputs").scrollIntoView({ behavior: "smooth", block: "center" });
    currentAnalysis = null;
    renderList();
  } catch {
    $("error").textContent = "Could not save this report in browser storage. Check available storage and try again.";
  }
});

renderList();
