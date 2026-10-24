const byId = (id) => document.getElementById(id);
const modal = byId("report-modal");
const steps = ["report-photo", "report-analysis", "report-review", "report-success"];

function showStep(id) {
  steps.forEach((step) => { byId(step).hidden = step !== id; });
}

function openReport() {
  modal.hidden = false;
  showStep("report-photo");
  byId("photo-input").value = "";
  byId("photo-name").textContent = "Choose a photo";
  byId("analyze-photo").disabled = true;
}

function closeReport() {
  modal.hidden = true;
}

byId("open-report").addEventListener("click", openReport);
byId("close-report").addEventListener("click", closeReport);
byId("photo-input").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  byId("photo-name").textContent = file ? file.name : "Choose a photo";
  byId("analyze-photo").disabled = !file;
});
byId("analyze-photo").addEventListener("click", () => showStep("report-analysis"));
byId("review-report").addEventListener("click", () => showStep("report-review"));
byId("send-report").addEventListener("click", () => showStep("report-success"));
byId("view-signal").addEventListener("click", () => {
  closeReport();
  byId("report-banner").hidden = false;
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "map-marker marker-new";
  marker.setAttribute("aria-label", "Newly reported signal");
  marker.innerHTML = "<i></i><span>New signal | MLK Library</span>";
  marker.style.left = "35%";
  marker.style.top = "49%";
  document.querySelector(".wake-map").append(marker);
  setTimeout(() => { byId("report-banner").hidden = true; }, 4500);
});
modal.addEventListener("click", (event) => { if (event.target === modal) closeReport(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeReport(); });
