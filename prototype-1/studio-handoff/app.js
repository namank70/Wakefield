/* Standalone Wakefield Studio handoff. This file uses local browser state only. */
const $ = (id) => document.getElementById(id);

const CATEGORIES = [
  { id: "lighting", label: "Lighting", department: "Facilities Electrical", words: ["light", "lamp", "lighting", "dark"] },
  { id: "walkway_obstruction", label: "Walkway obstruction", department: "Facilities", words: ["walkway", "obstruction", "blocked path", "debris", "path blocked"] },
  { id: "trash_overflow", label: "Trash overflow", department: "Custodial Services", words: ["trash", "garbage", "litter", "overflow", "bin"] },
  { id: "bike_scooter_parking", label: "Bike and scooter parking", department: "Transportation and Parking Services", words: ["bike", "bicycle", "scooter", "parking"] },
  { id: "water_leak", label: "Water leak", department: "Facilities Plumbing", words: ["water", "leak", "flood", "fountain", "pipe"] },
  { id: "door_lock", label: "Door or lock", department: "Facilities Lock Shop", words: ["door", "lock", "gate", "handle"] },
  { id: "printer_technology", label: "Printer or technology", department: "Campus IT", words: ["printer", "computer", "wifi", "technology", "screen"] },
  { id: "accessibility_barrier", label: "Accessibility barrier", department: "Accessibility and Facilities", words: ["accessibility", "wheelchair", "ramp", "curb", "tactile", "elevator"] },
  { id: "other", label: "Other", department: "Manual review", words: [] },
];

const initialSignals = [
  { title: "Bikes and scooters blocking pedestrian path", detail: "MLK Library · 2 reports", severity: "High", className: "cluster", marker: "2", x: 31, y: 57 },
  { title: "Water near the Engineering entrance", detail: "Engineering · urgent", severity: "Urgent", className: "urgent", marker: "!", x: 70, y: 47 },
  { title: "Path obstruction", detail: "Student Union · under review", severity: "Active", className: "green", marker: "3", x: 54, y: 77 },
];

const locations = {
  "MLK Library": { x: 31, y: 57 },
  "Tower Hall": { x: 43, y: 61 },
  Engineering: { x: 70, y: 47 },
  "Student Union": { x: 55, y: 76 },
  "Science Building": { x: 39, y: 72 },
  "South Parking Garage": { x: 21, y: 39 },
  "Campus Village": { x: 78, y: 66 },
  "Main Campus walkway": { x: 49, y: 60 },
};

const state = {
  desk: "student",
  zoom: 1,
  rotation: 0,
  file: null,
  photoUrl: null,
  analysis: null,
  signals: [...initialSignals],
  reports: loadReports(),
};

function loadReports() {
  try { return JSON.parse(localStorage.getItem("wakefield-studio-reports") || "[]"); }
  catch { return []; }
}
function saveReports() {
  try { localStorage.setItem("wakefield-studio-reports", JSON.stringify(state.reports)); }
  catch { /* Browser storage can be disabled; the current session still works. */ }
}
function setText(id, value) { $(id).textContent = value == null || value === "" ? "Not provided" : String(value); }
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 3600);
}
function selectedLocation() { return $("building").value || "MLK Library"; }
function resetStep(step) {
  $("photo-step").hidden = step !== 0;
  $("analysis-step").hidden = step !== 1;
  $("review-step").hidden = step !== 2;
  document.querySelectorAll("[data-step-dot]").forEach((dot) => {
    const n = Number(dot.dataset.stepDot);
    dot.classList.toggle("current", n === step);
    dot.classList.toggle("complete", n < step);
  });
}
function openModal() {
  $("report-modal").hidden = false;
  resetStep(0);
  $("error").hidden = true;
  $("send-error").hidden = true;
  $("analysis-error").hidden = true;
  document.body.classList.add("modal-open");
  setTimeout(() => $("photo").focus(), 80);
}
function closeModal() {
  $("report-modal").hidden = true;
  document.body.classList.remove("modal-open");
}
function renderSignals() {
  const layer = $("signals-layer");
  layer.replaceChildren();
  state.signals.forEach((signal) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `signal-marker ${signal.className || "new"}`;
    marker.style.left = `${signal.x}%`;
    marker.style.top = `${signal.y}%`;
    marker.setAttribute("aria-label", `${signal.title}. ${signal.detail}`);
    marker.title = `${signal.title} · ${signal.severity}`;
    marker.textContent = signal.marker || "•";
    marker.addEventListener("click", () => {
      $("side-title").textContent = signal.title;
      $("side-panel").hidden = false;
      renderReportList();
    });
    layer.append(marker);
  });
  $("signal-count").textContent = String(state.signals.length);
}
function renderReportList() {
  const list = $("report-list");
  list.replaceChildren();
  const starterSignals = [
    { title: "Bikes and scooters blocking pedestrian path", detail: "MLK Library · 2 reports", status: "Active · Transportation and Parking Services" },
    { title: "Water near Engineering entrance", detail: "Engineering · 1 report", status: "Urgent · Facilities Plumbing" },
    { title: "Path obstruction near Student Union", detail: "Student Union · 1 report", status: "Under review · Facilities" },
  ];
  [...state.reports.map((r) => ({ title: r.title, detail: `${r.location} · just now`, status: `${r.severity} · ${r.department}` })), ...starterSignals].forEach((report) => {
    const card = document.createElement("article");
    card.className = "report-item";
    const title = document.createElement("strong"); title.textContent = report.title;
    const detail = document.createElement("p"); detail.textContent = report.detail;
    const status = document.createElement("small"); status.textContent = report.status;
    card.append(title, detail, status);
    list.append(card);
  });
}
function normalizeCategory(raw) {
  if (raw && typeof raw === "object") raw = raw.id || raw.name || raw.label || raw.value || "";
  const key = String(raw || "").toLowerCase().replace(/[\s-]+/g, "_");
  const exact = CATEGORIES.find((item) => item.id === key || item.label.toLowerCase() === String(raw || "").toLowerCase());
  if (exact) return exact;
  const match = CATEGORIES.find((item) => item.words.some((word) => key.includes(word.replace(/\s+/g, "_")) || String(raw || "").toLowerCase().includes(word)));
  return match || CATEGORIES[CATEGORIES.length - 1];
}
function localSuggestion(file) {
  const filename = (file?.name || "").toLowerCase();
  const category = normalizeCategory(`${filename} ${selectedLocation()}`);
  const isBike = /bike|bicycle|scooter/.test(filename);
  const isUrgent = /urgent|flood|fire|injur/.test(filename);
  const picked = isBike ? CATEGORIES.find((item) => item.id === "bike_scooter_parking") : category.id === "other" ? CATEGORIES.find((item) => item.id === "walkway_obstruction") : category;
  const note = $("report-note").value.trim();
  return {
    category: picked.id,
    label: picked.label,
    summary: note || (isBike ? "Bikes and scooters may be blocking the pedestrian route." : `Possible ${picked.label.toLowerCase()} near ${selectedLocation()}. Please review the photo and confirm the details.`),
    severity: isUrgent ? "urgent" : "medium",
    department: picked.department,
    accessibilityImpact: /ramp|wheelchair|accessibility/.test(filename),
    confidence: null,
    provider: "local",
    location: selectedLocation(),
  };
}
async function analyzeWithEngine(file) {
  return localSuggestion(file);
}
function displayAnalysis() {
  const a = state.analysis;
  setText("analysis-title", a.label);
  setText("analysis-category", a.label);
  setText("analysis-summary", a.summary);
  setText("analysis-severity", a.severity);
  $("analysis-severity").className = `severity-pill ${a.severity}`;
  setText("analysis-department", a.department);
  setText("analysis-region", a.location);
  $("provider-label").textContent = "Local suggestion from file name and selected location · review before saving";
  $("accessibility-note").hidden = !a.accessibilityImpact;
  $("result-image").src = state.photoUrl || "";
}
async function beginAnalysis() {
  if (!state.file) return;
  $("error").hidden = true;
  $("analysis-error").hidden = true;
  resetStep(1);
  $("analysis-loading").hidden = false;
  $("analysis-result").hidden = true;
  try {
    state.analysis = await analyzeWithEngine(state.file);
    displayAnalysis();
    $("analysis-loading").hidden = true;
    $("analysis-result").hidden = false;
  } catch (error) {
    $("analysis-loading").hidden = true;
    $("analysis-result").hidden = false;
    $("analysis-error").hidden = false;
    $("analysis-error").textContent = `Could not prepare a suggestion: ${error?.message || "please try another image."}`;
    $("provider-label").textContent = "No report has been saved";
    $("confirm-analysis").disabled = true;
  }
}
async function createAndSendReport() {
  const a = state.analysis;
  const recipients = { university: $("to-university").checked, city: $("to-city").checked, landlord: $("to-landlord").checked };
  if (!Object.values(recipients).some(Boolean)) {
    $("send-error").hidden = false;
    $("send-error").textContent = "Choose at least one team to receive this report.";
    return;
  }
  const button = $("send-report");
  button.disabled = true;
  button.textContent = "Saving report…";
  $("send-error").hidden = true;
  try {
    const report = { id: `signal-${Date.now()}`, title: a.label, summary: a.summary, severity: a.severity, department: a.department, location: a.location, recipients, createdAt: new Date().toISOString(), provider: "local" };
    state.reports.unshift(report);
    saveReports();
    const spot = locations[a.location] || locations["Main Campus walkway"];
    state.signals.unshift({ title: a.summary, detail: `${a.location} · just now`, severity: a.severity, className: a.severity === "urgent" ? "urgent" : "new", marker: a.severity === "urgent" ? "!" : "•", x: spot.x, y: spot.y });
    $("open-count").textContent = String(Number($("open-count").textContent) + 1);
    $("points").textContent = String(Number($("points").textContent) + 2);
    closeModal();
    renderSignals();
    renderReportList();
    showToast("Report saved in this browser. A new signal is on the map.");
    resetForm();
  } catch (error) {
    $("send-error").hidden = false;
    $("send-error").textContent = `The report was not saved: ${error?.message || "please try again."}`;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Save report <span>→</span>';
  }
}
function resetForm() {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.file = null; state.photoUrl = null; state.analysis = null;
  $("photo").value = ""; $("building").value = ""; $("photo-preview").hidden = true;
  $("photo-prompt").textContent = "Choose a photo"; $("analyze-button").disabled = true;
  $("to-university").checked = true; $("to-city").checked = false; $("to-landlord").checked = false;
  $("confirm-analysis").disabled = false;
  resetStep(0);
}

$("open-report").addEventListener("click", openModal);
$("close-report").addEventListener("click", closeModal);
$("report-modal").addEventListener("click", (event) => { if (event.target === $("report-modal")) closeModal(); });
$("photo").addEventListener("change", () => {
  const file = $("photo").files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { $("error").hidden = false; $("error").textContent = "Choose an image file to continue."; return; }
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.file = file; state.photoUrl = URL.createObjectURL(file);
  $("preview-image").src = state.photoUrl; $("photo-preview").hidden = false;
  $("photo-prompt").textContent = file.name; $("analyze-button").disabled = false;
  $("error").hidden = true;
});
$("change-photo").addEventListener("click", () => $("photo").click());
$("analyze-button").addEventListener("click", beginAnalysis);
$("confirm-analysis").addEventListener("click", () => {
  if (!state.analysis) return;
  $("review-title").textContent = state.analysis.label;
  $("review-description").textContent = state.analysis.summary;
  $("to-university-label").textContent = state.analysis.department;
  resetStep(2);
});
$("back-to-photo").addEventListener("click", () => { $("confirm-analysis").disabled = false; resetStep(0); });
$("back-to-analysis").addEventListener("click", () => resetStep(1));
$("send-report").addEventListener("click", createAndSendReport);
$("map-tab").addEventListener("click", () => { $("side-panel").hidden = true; document.querySelectorAll(".rail-button").forEach((b) => b.classList.remove("active")); $("map-tab").classList.add("active"); });
$("signals-tab").addEventListener("click", () => { $("side-title").textContent = "Signals"; $("side-panel").hidden = false; renderReportList(); document.querySelectorAll(".rail-button").forEach((b) => b.classList.remove("active")); $("signals-tab").classList.add("active"); });
$("mobile-signals").addEventListener("click", () => $("signals-tab").click());
$("close-side").addEventListener("click", () => { $("side-panel").hidden = true; $("signals-tab").classList.remove("active"); $("map-tab").classList.add("active"); });
$("fixing-tab").addEventListener("click", () => { $("side-title").textContent = "Campus fixing list"; $("side-panel").hidden = false; renderReportList(); });

function applyMapPose() {
  $("map-plane").style.setProperty("--view-zoom", String(state.zoom));
  $("map-plane").style.setProperty("--view-rotation", `${state.rotation}deg`);
}
$("zoom-in").addEventListener("click", () => { state.zoom = Math.min(1.34, state.zoom + .08); applyMapPose(); });
$("zoom-out").addEventListener("click", () => { state.zoom = Math.max(.88, state.zoom - .08); applyMapPose(); });
$("rotate-map").addEventListener("click", () => { state.rotation = (state.rotation + 5) % 360; applyMapPose(); });
$("center-map").addEventListener("click", () => { state.zoom = 1; state.rotation = 0; applyMapPose(); });
$("recenter").addEventListener("click", () => { state.zoom = 1; state.rotation = 0; applyMapPose(); showToast("Map recentered on SJSU Main Campus."); });
$("compass").addEventListener("click", () => { state.rotation = 0; applyMapPose(); });
document.querySelectorAll("[data-desk]").forEach((button) => button.addEventListener("click", () => {
  state.desk = button.dataset.desk;
  document.body.classList.toggle("is-university", state.desk === "university");
  document.querySelectorAll("[data-desk]").forEach((item) => item.classList.toggle("selected", item === button));
  $("fixing-tab").hidden = state.desk !== "university";
}));

const buildings = ["MLK Library", "Tower Hall", "Engineering", "Student Union", "Science Building", "South Parking Garage", "Campus Village", "Main Campus walkway", "Art Building", "Duncan Hall", "Washington Square Hall", "MacQuarrie Hall"];
$("building-search").addEventListener("input", () => {
  const query = $("building-search").value.trim().toLowerCase();
  const results = buildings.filter((name) => name.toLowerCase().includes(query));
  const list = $("search-results"); list.replaceChildren();
  results.slice(0, 5).forEach((name) => {
    const li = document.createElement("li"); const button = document.createElement("button");
    button.type = "button"; button.textContent = name;
    button.addEventListener("click", () => { $("building-search").value = name; list.hidden = true; const p = locations[name] || locations["Main Campus walkway"]; document.querySelector(".you-marker").style.left = `${p.x}%`; document.querySelector(".you-marker").style.top = `${p.y}%`; showToast(`${name} selected on the campus map.`); });
    li.append(button); list.append(li);
  });
  list.hidden = !query || results.length === 0;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closeModal(); $("side-panel").hidden = true; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("building-search").focus(); }
});

renderSignals();
renderReportList();
