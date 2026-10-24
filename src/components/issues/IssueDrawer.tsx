"use client";

import { categories, severityLabels } from "@/lib/config/display";
import { nearestLandmark, regionNameFor } from "@/lib/geo/campus";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import type { Issue } from "@/lib/types";
import { X } from "lucide-react";

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
      <p className="mt-4 text-sm text-slate-300">
        {issue.severity === "urgent"
          ? "Urgent signals open the nearby paths and building outline immediately. The rest of campus stays quiet."
          : "This signal reveals its immediate context. A quiet block still means few recent reports, not a verified safe route."}
      </p>
    </aside>
  );
}
