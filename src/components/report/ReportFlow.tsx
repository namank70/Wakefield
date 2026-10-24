"use client";

import { compressImage } from "@/lib/api/images";
import { getClient } from "@/lib/api";
import { categories } from "@/lib/config/display";
import { dataMode, guidedMode } from "@/lib/config/env";
import { isInsideReporting, nearestLandmark, regionIdFor, reportLocations, seededLibraryPin } from "@/lib/geo/campus";
import { campusStore } from "@/lib/state/store";
import { demoScenarios, type DemoScenario } from "@/lib/demo/scenarios";
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
  const [demoScenario, setDemoScenario] = useState<DemoScenario | null>(null);
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<DuplicateSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function keep(next: Blob, scenario: DemoScenario | null = null) {
    if (preview) URL.revokeObjectURL(preview);
    setBlob(next);
    setPreview(URL.createObjectURL(next));
    setDemoScenario(scenario);
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
    campusStore.closeReport();
  }

  async function uploadAndAnalyze() {
    if (!blob || !campus.draftLocation) return;
    setStep("upload");
    setError(null);
    setBusy(true);
    try {
      const compressed = await compressImage(blob);
      const uploaded = await getClient().uploadPhoto(compressed, setProgress);
      setPhotoId(uploaded.photoId);
      const result = demoScenario
        ? demoScenario.analysis
        : await getClient().analyzePhoto({
          photoId: uploaded.photoId,
          latitude: campus.draftLocation.latitude,
          longitude: campus.draftLocation.longitude,
          campusId: "sjsu",
        });
      setAnalysis(result);
      setDescription(demoScenario?.studentDescription ?? result.summary);
      setStep("analysis");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed. The photo is still here.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewDuplicate() {
    if (!analysis || !campus.draftLocation) return;
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
        <p className="font-mono text-sm">
          {progress?.indeterminate || !progress ? "Uploading…" : `Uploading ${Math.round((progress.loaded / Math.max(progress.total, 1)) * 100)}%`}
        </p>
      ) : null}
      {step === "analysis" && analysis ? (
        <AnalysisStep analysis={analysis} description={description} onDescription={setDescription} onChange={setAnalysis} />
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
          <button type="button" onClick={() => void uploadAndAnalyze()}>Retry upload</button>
        ) : null}
        {step === "analysis" ? (
          <button type="button" disabled={busy} onClick={() => void reviewDuplicate()}>Check for a duplicate</button>
        ) : null}
      </div>
    </div>
  );
}

function CameraStage({ onCapture }: { onCapture: (blob: Blob, scenario?: DemoScenario | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  async function loadSample(scenario: DemoScenario) {
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
      <video ref={videoRef} className="aspect-[4/3] w-full rounded-md bg-black object-cover" playsInline muted />
      {!cameraRequested ? <p className="text-xs text-slate-400">Choose a prepared photo, upload an image, or open your camera. Your camera only starts if you ask to open it.</p> : null}
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
            <p className="wake-sample-kicker">Four prepared campus examples</p>
            <p className="wake-sample-note">Prepared photo examples use saved classifications. Other uploads need your description and manual review.</p>
          </div>
          <div className="wake-sample-grid">
            {demoScenarios.map((scenario) => (
              <button key={scenario.id} type="button" className="wake-sample-card" onClick={() => void loadSample(scenario)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scenario.image} alt="" />
                <span>{scenario.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocationStep({ scenario }: { scenario: DemoScenario | null }) {
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
        {analysis.provider === "eaiser" ? "EAiSER photo analysis" : analysis.provider === "cached" ? "Prepared photo · saved classification" : "Manual review · no image analysis configured"}
      </p>
      {analysis.provider !== "eaiser" ? <p className="text-xs text-slate-400">This is not a live AI result. Prepared photos use saved labels; other uploads need your description and edits before saving.</p> : null}
      <label className="block">
        Category
        <select value={analysis.category} onChange={(event) => onChange({ ...analysis, category: event.target.value })}>
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
        Department
        <input value={analysis.department} onChange={(event) => onChange({ ...analysis, department: event.target.value })} />
      </label>
      <label className="block">
        Confidence
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={analysis.confidence}
          onChange={(event) => onChange({ ...analysis, confidence: Number(event.target.value) })}
        />
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
