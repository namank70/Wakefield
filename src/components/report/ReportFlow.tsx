"use client";

import { compressImage } from "@/lib/api/images";
import { getClient } from "@/lib/api";
import { categories } from "@/lib/config/display";
import { dataMode, guidedMode } from "@/lib/config/env";
import { isInsideReporting, nearestLandmark, regionIdFor, reportLocations, seededLibraryPin } from "@/lib/geo/campus";
import { campusStore } from "@/lib/state/store";
import { testPhotos, type CampusTestPhoto } from "@/lib/demo/scenarios";
import { useVisionStatus } from "@/lib/state/use-vision";
import { useCampus } from "@/lib/state/use-campus";
import type { AnalysisResult, DuplicateSuggestion, UploadProgress } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Step = "camera" | "preview" | "location" | "upload" | "analysis" | "duplicate" | "done";

function insideDraft(location: { latitude: number; longitude: number } | null) {
  return location ? isInsideReporting(location.latitude, location.longitude) : false;
}

export function ReportFlow() {
  const campus = useCampus();
  const [step, setStep] = useState<Step>("camera");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [demoScenario, setDemoScenario] = useState<CampusTestPhoto | null>(null);
  const [processing, setProcessing] = useState("Preparing photo…");
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<DuplicateSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function keep(next: Blob, scenario: CampusTestPhoto | null = null) {
    if (dataMode === "mock" && photoId) campusStore.discardPhoto(photoId);
    if (preview) URL.revokeObjectURL(preview);
    setBlob(next);
    setPreview(URL.createObjectURL(next));
    setDemoScenario(scenario);
    setPhotoId(null);
    setAnalysis(null);
    setProgress(null);
    if (scenario) {
      const location = reportLocations.find((item) => item.id === scenario.buildingId);
      campusStore.setFocusLocation(location ? { id: location.id, name: location.name, kind: location.kind } : null);
      campusStore.setDraftLocation({
        latitude: scenario.latitude,
        longitude: scenario.longitude,
        accuracy: null,
        source: "manual",
      });
    } else {
      campusStore.setFocusLocation(null);
      campusStore.setDraftLocation(null);
    }
    setError(null);
    setStep("preview");
  }

  function close() {
    if (dataMode === "mock" && photoId && step !== "done") campusStore.discardPhoto(photoId);
    campusStore.closeReport();
  }

  async function uploadAndAnalyze() {
    if (!blob || !campus.draftLocation) return;
    setStep("upload");
    setError(null);
    setBusy(true);
    setProcessing("Preparing photo…");
    try {
      let currentPhotoId = photoId;
      if (!currentPhotoId) {
        const compressed = await compressImage(blob);
        const uploaded = await getClient().uploadPhoto(compressed, setProgress);
        currentPhotoId = uploaded.photoId;
        setPhotoId(currentPhotoId);
      }
      setProcessing("Photo AI is reviewing the image… The first photo may take longer while the model loads.");
      const result = await getClient().analyzePhoto({
          photoId: currentPhotoId,
          latitude: campus.draftLocation.latitude,
          longitude: campus.draftLocation.longitude,
          campusId: "sjsu",
        });
      setAnalysis(result);
      setDescription(result.summary);
      setStep("analysis");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed. The photo is still here.");
      setProcessing("Photo AI could not finish this review.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewDuplicate() {
    if (!analysis || !campus.draftLocation) return;
    if (analysis.issueDetected === false || !analysis.summary.trim()) {
      setError("Describe the issue you want to report before continuing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const match = await getClient().suggestDuplicate({
        category: analysis.category,
        latitude: campus.draftLocation.latitude,
        longitude: campus.draftLocation.longitude,
        campusId: "sjsu",
      });
      if (match) {
        setSuggestion(match);
        setStep("duplicate");
      } else {
        await submit(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not check for a duplicate.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(attachToIssueId: string | null) {
    if (!analysis || !campus.draftLocation) return;
    if (!isInsideReporting(campus.draftLocation.latitude, campus.draftLocation.longitude)) {
      setError("Move the pin inside the SJSU campus boundary.");
      setStep("location");
      return;
    }
    setBusy(true);
    try {
      const selectedBuilding = campus.focusLocation?.kind === "building" ? campus.focusLocation : null;
      const building = selectedBuilding
        ? { id: selectedBuilding.id }
        : nearestLandmark(campus.draftLocation.latitude, campus.draftLocation.longitude);
      await getClient().createReport({
        campusId: "sjsu",
        regionId: regionIdFor(campus.draftLocation.latitude, campus.draftLocation.longitude),
        buildingId: building?.id ?? null,
        photoId,
        latitude: campus.draftLocation.latitude,
        longitude: campus.draftLocation.longitude,
        locationSource: campus.draftLocation.source,
        locationAccuracyMeters: campus.draftLocation.accuracy,
        studentDescription: description,
        analysis,
        reporterId: "scout-1",
        attachToIssueId,
      });
      if (dataMode === "mock" && demoScenario && photoId) campusStore.linkTestPhoto(photoId, demoScenario.image);
      window.dispatchEvent(new Event("wakefield:data-changed"));
      setStep("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The report was not created. You can retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wake-report" role="dialog" aria-label="Report a signal">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">Report a signal</h2>
        <button type="button" onClick={close}>Close</button>
      </div>
      {step === "camera" ? <CameraStage onCapture={keep} /> : null}
      {step === "preview" && preview ? (
        <div className="space-y-3">
          {demoScenario?.synthetic ? <p className="wake-ai-photo-label">AI-generated test photo · choose where to place it on the map</p> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Captured campus signal" className="max-h-64 w-full rounded-md object-cover" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("camera")}>Retake</button>
            <button type="button" onClick={() => { campusStore.setPlacingPin(true); setStep("location"); }}>Use this photo</button>
          </div>
        </div>
      ) : null}
      {step === "location" ? <LocationStep scenario={demoScenario} /> : null}
      {step === "upload" ? (
        <div className="wake-ai-processing" role="status">{busy ? <span className="wake-ai-spinner" aria-hidden="true" /> : null}<div><p>{processing}</p>{progress && !processing.startsWith("Photo AI") ? <small>Photo ready: {Math.round(100 * progress.loaded / Math.max(progress.total, 1))}%</small> : null}</div></div>
      ) : null}
      {step === "analysis" && analysis ? (
        <><AnalysisStep analysis={analysis} description={description} onDescription={setDescription} onChange={setAnalysis} />{analysis.issueDetected === false ? <button type="button" className="mt-3" onClick={() => setStep("camera")}>Choose another photo</button> : null}</>
      ) : null}
      {step === "duplicate" && suggestion ? (
        <div className="space-y-3 text-sm">
          <p>This looks like an existing signal {suggestion.distanceMeters} m away: {suggestion.summary}</p>
          <p className="font-mono text-xs text-slate-300">{suggestion.reportCount} reports · {suggestion.severity}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void submit(suggestion.issueId)}>Add evidence to this signal</button>
            <button type="button" disabled={busy} onClick={() => void submit(null)}>Report as a new signal</button>
          </div>
        </div>
      ) : null}
      {step === "done" ? (
        <div className="space-y-3">
          <p>Signal added to your Wakefield workspace. Watch the nearby map region respond.</p>
          <p className="text-sm text-slate-300">
            {dataMode === "mock" ? "Saved to this browser's Wakefield workspace. Campus dispatch is not connected." : "Saved through Wakefield's connected service. The analysis label shows whether the result was prepared or provider-generated."}
          </p>
          <button type="button" onClick={() => { campusStore.viewPendingSignal(); close(); }}>View signal</button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-amber">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {step === "location" ? (
          <button type="button" disabled={!campus.draftLocation || busy || !insideDraft(campus.draftLocation)} onClick={() => void uploadAndAnalyze()}>
            Continue
          </button>
        ) : null}
        {step === "upload" && error ? (
          <>
            <button type="button" disabled={busy} onClick={() => void uploadAndAnalyze()}>Retry photo AI</button>
            <button type="button" disabled={busy || !photoId} onClick={() => {
              setAnalysis({ category: "other", summary: "", severity: "low", department: "Manual review", confidence: 0, accessibilityImpact: false, tags: ["manual-review"], provider: "mock", issueDetected: true });
              setDescription(""); setError(null); setStep("analysis");
            }}>Review manually</button>
          </>
        ) : null}
        {step === "analysis" ? (
          <button type="button" disabled={busy || analysis?.issueDetected === false || !analysis?.summary.trim()} onClick={() => void reviewDuplicate()}>Check for a duplicate</button>
        ) : null}
      </div>
    </div>
  );
}

function CameraStage({ onCapture }: { onCapture: (blob: Blob, scenario?: CampusTestPhoto | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [area, setArea] = useState("all");
  const { status } = useVisionStatus();

  async function loadSample(scenario: CampusTestPhoto) {
    try {
      const response = await fetch(scenario.image);
      if (!response.ok) throw new Error("The sample photo could not be loaded.");
      onCapture(await response.blob(), scenario);
    } catch {
      setMessage("Could not load that sample photo. Try uploading a photo from your device instead.");
    }
  }

  useEffect(() => {
    if (!cameraRequested) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser has no camera API. Upload a photo instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (reason) {
        const name = reason instanceof DOMException ? reason.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") setMessage("Camera permission was denied. Upload a photo instead.");
        else if (name === "NotFoundError" || name === "NotReadableError") setMessage("No camera is available. Upload a photo instead.");
        else setMessage("The camera could not start. Upload a photo instead.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraRequested]);

  return (
    <div className="space-y-3">
      {cameraRequested ? <video ref={videoRef} className="aspect-[4/3] w-full rounded-md bg-black object-cover" playsInline muted /> : null}
      <p className={`wake-ai-status ${status?.ready ? "is-ready" : ""}`} role="status">{status ? status.ready ? "Photo AI ready · automatic category, severity and team" : status.message : "Checking photo AI…"}</p>
      {!cameraRequested ? <p className="text-xs text-slate-400">Choose a campus photo, upload an image, or open your camera.</p> : null}
      {message ? <p className="text-sm text-amber">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCameraRequested(true)}
          disabled={cameraRequested}
        >
          {cameraRequested ? "Camera starting…" : "Open camera"}
        </button>
        <button
          type="button"
          disabled={!cameraReady}
          onClick={() => {
            const video = videoRef.current;
            if (!video || !video.videoWidth) return;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d")?.drawImage(video, 0, 0);
            canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.92);
          }}
        >
          Capture
        </button>
        <label className="wake-file">
          Upload a photo instead
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onCapture(file);
            }}
          />
        </label>
      </div>
      {guidedMode ? (
        <div className="wake-sample-set">
          <div>
            <p className="wake-sample-kicker">Campus photo library · {testPhotos.length} photos</p>
            <p className="wake-sample-note">The AI reads each image. Generated scenes are labeled for testing; choose or change their map location before reporting.</p>
          </div>
          <div className="wake-photo-filters" role="group" aria-label="Filter test photos by area">
            {[["all", "All"], ["library", "Library"], ["engineering", "Engineering"], ["student-union", "Student Union"]].map(([id, label]) => <button key={id} type="button" aria-pressed={area === id} onClick={() => setArea(id)}>{label}</button>)}
          </div>
          <div className="wake-sample-grid">
            {testPhotos.filter((photo) => area === "all" || photo.regionId === area).map((scenario) => (
              <button key={scenario.id} type="button" className="wake-sample-card" onClick={() => void loadSample(scenario)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scenario.image} alt="" />
                <span>{scenario.title}<small>{scenario.synthetic ? "AI-generated test photo" : "Original photo"}</small></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocationStep({ scenario }: { scenario: CampusTestPhoto | null }) {
  const campus = useCampus();
  const [message, setMessage] = useState(scenario
    ? `${scenario.locationLabel}. Confirm or change the location; the photo does not determine it.`
    : "Choose a building or walkway, place the pin on the map, or use this device's location.");
  const inside = campus.draftLocation ? isInsideReporting(campus.draftLocation.latitude, campus.draftLocation.longitude) : false;

  useEffect(() => {
    campusStore.setPlacingPin(true);
    return () => campusStore.setPlacingPin(false);
  }, []);

  function useDevice() {
    if (!navigator.geolocation) {
      setMessage("This browser cannot read device location. Place the pin on the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        campusStore.setFocusLocation(null);
        campusStore.setDraftLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "device",
        });
        setMessage(`Device location accuracy about ±${Math.round(position.coords.accuracy)} m. Drag the pin if it is off.`);
      },
      () => setMessage("Location permission was denied. Place the pin on the map."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function selectPlace(id: string) {
    const place = reportLocations.find((item) => item.id === id);
    if (!place) {
      campusStore.setFocusLocation(null);
      return;
    }
    campusStore.setFocusLocation({ id: place.id, name: place.name, kind: place.kind });
    campusStore.setDraftLocation({ latitude: place.latitude, longitude: place.longitude, accuracy: null, source: "manual" });
    campusStore.flyTo(place.latitude, place.longitude, 18.5);
    setMessage(`${place.name} selected. The ${place.kind === "path" ? "walkway" : "building"} is highlighted on the map; adjust the pin if needed.`);
  }

  return (
    <div className="space-y-3 text-sm">
      <p>{message}</p>
      <label className="block">
        Campus location
        <select className="mt-1 w-full" value={campus.focusLocation?.id ?? ""} onChange={(event) => selectPlace(event.target.value)}>
          <option value="">Select a building or walkway…</option>
          <optgroup label="Buildings">
            {reportLocations.filter((place) => place.kind === "building").map((place) => (
              <option key={place.id} value={place.id}>{place.name}</option>
            ))}
          </optgroup>
          <optgroup label="Walkways">
            {reportLocations.filter((place) => place.kind === "path").map((place) => (
              <option key={place.id} value={place.id}>{place.name}</option>
            ))}
          </optgroup>
        </select>
      </label>
      {campus.draftLocation ? (
        <p className="font-mono text-xs">
          {campus.draftLocation.latitude.toFixed(5)}, {campus.draftLocation.longitude.toFixed(5)} · {campus.draftLocation.source}
          {campus.draftLocation.accuracy ? ` · ±${Math.round(campus.draftLocation.accuracy)} m` : ""}
          {inside ? " · inside campus" : " · outside the reporting boundary"}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useDevice}>Use device location</button>
        {guidedMode ? (
          <button
            type="button"
            onClick={() => {
              campusStore.setDraftLocation({
                latitude: scenario?.latitude ?? seededLibraryPin.latitude,
                longitude: scenario?.longitude ?? seededLibraryPin.longitude,
                accuracy: null,
                source: "manual",
              });
              const location = reportLocations.find((item) => item.id === scenario?.buildingId);
              campusStore.setFocusLocation(location ? { id: location.id, name: location.name, kind: location.kind } : null);
              setMessage(scenario
                ? `${scenario.locationLabel}. This suggested location is hand-placed; the photo does not determine it.`
                : `${seededLibraryPin.label}. This is a suggested campus location, not your device location.`);
            }}
          >
            {scenario ? "Use suggested location" : "Use campus starting point"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AnalysisStep({
  analysis,
  description,
  onDescription,
  onChange,
}: {
  analysis: AnalysisResult;
  description: string;
  onDescription: (value: string) => void;
  onChange: (value: AnalysisResult) => void;
}) {
  return (
    <form className="space-y-3 text-sm" onSubmit={(event) => event.preventDefault()}>
      <p className="font-mono text-[11px] uppercase tracking-wider text-cyan">
        {analysis.provider === "ollama" ? `Local photo AI · ${analysis.model || "Ollama"}` : analysis.provider === "eaiser" ? "EAiSER photo analysis" : analysis.provider === "cached" ? "Prepared photo · saved classification" : "Reporter review"}
      </p>
      {analysis.rationale ? <p className="wake-ai-rationale">{analysis.rationale}</p> : null}
      {analysis.provider === "ollama" ? <p className="text-xs text-slate-400">{analysis.cacheHit ? "Reused the model's previous analysis of this exact photo." : `Analyzed locally${analysis.durationMs ? ` in ${(analysis.durationMs / 1000).toFixed(1)} seconds` : ""}.`} Review the suggestions before saving.</p> : null}
      {analysis.issueDetected === false ? <div className="wake-ai-no-issue"><strong>No clear issue detected</strong><p>A clear photo does not need a report. You can choose another photo or continue with your own description.</p><button type="button" onClick={() => onChange({ ...analysis, issueDetected: true, provider: "mock", summary: "", confidence: 0, rationale: "The reporter chose to review the photo manually.", model: undefined })}>I see an issue · review manually</button></div> : null}
      <label className="block">
        Category
        <select value={analysis.category} onChange={(event) => onChange({ ...analysis, category: event.target.value, department: categories.find((item) => item.id === event.target.value)?.department || "Manual review" })}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Severity
        <select value={analysis.severity} onChange={(event) => onChange({ ...analysis, severity: event.target.value as AnalysisResult["severity"] })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="block">
        Summary
        <textarea value={analysis.summary} onChange={(event) => onChange({ ...analysis, summary: event.target.value })} rows={3} />
      </label>
      <label className="block">
        Suggested department
        <input value={analysis.department} onChange={(event) => onChange({ ...analysis, department: event.target.value })} />
      </label>
      <label className="block">
        Model confidence estimate
        <output className="mt-1 block text-slate-300">{analysis.provider === "mock" ? "Not scored" : `${Math.round(analysis.confidence * 100)}% · review required`}</output>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={analysis.accessibilityImpact}
          onChange={(event) => onChange({ ...analysis, accessibilityImpact: event.target.checked })}
        />
        Accessibility impact
      </label>
      <label className="block">
        Your note
        <textarea value={description} onChange={(event) => onDescription(event.target.value)} rows={2} />
      </label>
    </form>
  );
}
