"use client";

import { getClient } from "@/lib/api";
import { categories, severityLabels } from "@/lib/config/display";
import { nearestLandmark, regionNameFor } from "@/lib/geo/campus";
import { buildingHealth, healthTone, placeForIssue } from "@/lib/health/score";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import type { Issue } from "@/lib/types";
import { X } from "lucide-react";
import { useState } from "react";

function labelFor(category: string) {
  return categories.find((item) => item.id === category)?.label ?? category;
}

export function IssueDrawer({ issue }: { issue: Issue }) {
  const campus = useCampus();
  const reports = campus.reports.filter((report) => report.issueId === issue.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const events = campus.events.filter((event) => event.issueId === issue.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const photos = campus.photos.filter((photo) => photo.issueId === issue.id);
  const identities = new Set(reports.map((report) => report.reporterId)).size;
  const nearby = nearestLandmark(issue.latitude, issue.longitude, 180);
  const place = nearby?.name ?? regionNameFor(issue.regionId);
  const opened = reports[0]?.createdAt ?? issue.createdAt;
  const aiObservation = reports.slice().reverse().find((report) => report.analysisProvider === "ollama" && report.analysisRationale);
  const placeHealth = buildingHealth(campus.issues).find((place) => place.id === placeForIssue(issue).id) ?? { ...placeForIssue(issue), health: 100 };
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch {
      // The store already published the notice.
    } finally {
      setBusy(false);
    }
  }
  const timeline = [
    ...events.map((event) => ({ id: event.id, at: event.createdAt, text: event.note })),
    ...reports.map((report) => ({
      id: report.id,
      at: report.createdAt,
      text: `${report.reporterId} · ${report.locationSource === "device" ? "device location" : "manual pin"}${report.locationAccuracyMeters ? ` · ±${Math.round(report.locationAccuracyMeters)} m` : ""}`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <aside className="wake-drawer" aria-label="Signal detail">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-balance font-display text-xl leading-tight">{issue.summary}</h2>
        <button type="button" className="wake-icon-button" aria-label="Close signal" onClick={() => campusStore.selectIssue(null)}>
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {photos.map((photo) => {
          const url = campusStore.previewFor(photo.id);
          return url ? (
            // Session blob URLs cannot go through next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={url} alt="Evidence captured this session" className="max-h-48 w-full rounded-md object-cover" />
          ) : (
            <p key={photo.id} className="font-mono text-xs text-slate-400">
              Photo preview is kept for this browser session only.
            </p>
          );
        })}
        {photos.length === 0 ? <p className="font-mono text-xs text-slate-400">No photo is attached to this signal.</p> : null}
      </div>
      <p className="mt-3 flex flex-wrap gap-2">
        <span className="wake-chip">{labelFor(issue.category)}</span>
        <span className="wake-chip">{severityLabels[issue.severity]} impact</span>
        <span className={`wake-status is-${issue.status}`}>{issue.status.replaceAll("_", " ")}</span>
      </p>
      {aiObservation ? <div className="wake-ai-rationale mt-3"><p className="font-mono text-[10px] uppercase tracking-wider text-cyan">Photo AI observation · {aiObservation.analysisModel || "local vision"}</p><p className="mt-1">{aiObservation.analysisRationale}</p></div> : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Severity</dt>
          <dd>{severityLabels[issue.severity]}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Category</dt>
          <dd>{labelFor(issue.category)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Place</dt>
          <dd>{place}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Building health</dt>
          <dd>
            <span className="wake-health" aria-hidden="true">
              <span style={{ width: `${placeHealth.health}%`, background: healthTone(placeHealth.health) }} />
            </span>
            {placeHealth.health} at {placeHealth.name}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Reports</dt>
          <dd>
            {issue.reportCount} total · {identities} independent
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Department</dt>
          <dd>{issue.department}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Accessibility</dt>
          <dd>{issue.accessibilityImpact ? "Accessibility impact flagged" : "No accessibility impact flagged"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Status</dt>
          <dd className="capitalize">{issue.status.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Opened</dt>
          <dd>{new Date(opened).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Updated</dt>
          <dd>{new Date(issue.updatedAt).toLocaleString()}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Pin</dt>
          <dd className="font-mono text-xs">
            {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}
          </dd>
        </div>
      </dl>
      <h3 className="mt-5 font-display text-base">Evidence timeline</h3>
      <ol className="mt-2 space-y-3">
        {timeline.map((item) => (
          <li key={item.id}>
            <p className="font-mono text-[10px] text-slate-400">{new Date(item.at).toLocaleString()}</p>
            <p className="text-sm">{item.text}</p>
          </li>
        ))}
      </ol>
      {campus.desk === "university" && (issue.status === "open" || issue.status === "reopened") ? (
        <button type="button" className="mt-4" disabled={busy} onClick={() => run(() => getClient().updateIssueStatus(issue.id, "in_progress", "University claimed this signal."))}>
          Claim
        </button>
      ) : null}
      {campus.desk === "university" && issue.status === "in_progress" ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => getClient().updateIssueStatus(issue.id, "awaiting_verification", note.trim() || "University marked this signal fixed."));
          }}
        >
          <label className="block text-xs text-slate-300" htmlFor="repair-note">Update</label>
          <textarea id="repair-note" value={note} rows={2} placeholder="What was fixed?" onChange={(event) => setNote(event.target.value)} />
          <button type="submit" disabled={busy}>Mark fixed</button>
        </form>
      ) : null}
      {campus.desk === "student" && issue.status === "awaiting_verification" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => getClient().verifyIssue(issue.id, { confirmed: true, actorId: "scout-1" }))}>{"It's fixed"}</button>
          <button type="button" disabled={busy} onClick={() => run(() => getClient().verifyIssue(issue.id, { confirmed: false, actorId: "scout-1" }))}>Still there</button>
        </div>
      ) : null}
      <p className="mt-4 text-sm text-slate-300">
        {issue.severity === "urgent"
          ? "Urgent signals open the nearby paths and building outline immediately. The rest of campus stays quiet."
          : "This signal reveals its immediate context. A quiet block still means few recent reports, not a verified safe route."}
      </p>
    </aside>
  );
}
