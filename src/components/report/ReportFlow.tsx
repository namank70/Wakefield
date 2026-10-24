"use client";

import { compressImage } from "@/lib/api/images";
import { getClient } from "@/lib/api";
import { categories } from "@/lib/config/display";
import { dataMode, demoMode } from "@/lib/config/env";
import { isInsideReporting, nearestLandmark, regionIdFor, seededLibraryPin } from "@/lib/geo/campus";
import { campusStore } from "@/lib/state/store";
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
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<DuplicateSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function keep(next: Blob) {
    if (preview) URL.revokeObjectURL(preview);
    setBlob(next);
    setPreview(URL.createObjectURL(next));
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
      const result = await getClient().analyzePhoto({
        photoId: uploaded.photoId,
        latitude: campus.draftLocation.latitude,
        longitude: campus.draftLocation.longitude,
        campusId: "sjsu",
      });
      setAnalysis(result);
      setDescription(result.summary);
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
      const building = nearestLandmark(campus.draftLocation.latitude, campus.draftLocation.longitude);
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
      {step === "location" ? <LocationStep /> : null}
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
          <p>Signal received. The map has not moved.</p>
          <p className="text-sm text-slate-300">
            {dataMode === "mock" ? "The mock adapter kept the photo in this session only. It is not permanent storage." : "The live adapter sent the report to the configured API."}
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

function CameraStage({ onCapture }: { onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <div className="space-y-3">
      <video ref={videoRef} className="aspect-[4/3] w-full rounded-md bg-black object-cover" playsInline muted />
      {message ? <p className="text-sm text-amber">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
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
    </div>
  );
}

function LocationStep() {
  const campus = useCampus();
  const [message, setMessage] = useState("Place the pin on the campus map, or use this device's location.");
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

  return (
    <div className="space-y-3 text-sm">
      <p>{message}</p>
      {campus.draftLocation ? (
        <p className="font-mono text-xs">
          {campus.draftLocation.latitude.toFixed(5)}, {campus.draftLocation.longitude.toFixed(5)} · {campus.draftLocation.source}
          {campus.draftLocation.accuracy ? ` · ±${Math.round(campus.draftLocation.accuracy)} m` : ""}
          {inside ? " · inside campus" : " · outside the reporting boundary"}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useDevice}>Use device location</button>
        {demoMode ? (
          <button
            type="button"
            onClick={() => {
              campusStore.setDraftLocation({
                latitude: seededLibraryPin.latitude,
                longitude: seededLibraryPin.longitude,
                accuracy: null,
                source: "manual",
              });
              setMessage(`${seededLibraryPin.label}. This is a seeded demo pin, not this device.`);
            }}
          >
            Use seeded SJSU location
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
      <p className="font-mono text-[11px] uppercase tracking-wider text-cyan">Mock EAiSER output · {analysis.provider}</p>
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
