"use client";

import { categories, severityLabels } from "@/lib/config/display";
import { fixingOrder } from "@/lib/health/score";
import { getClient } from "@/lib/api";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { useState } from "react";

export function FixingList() {
  const campus = useCampus();
  const queue = fixingOrder(campus.issues);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function claim(issueId: string) {
    setBusy(issueId);
    try {
      await getClient().updateIssueStatus(issueId, "in_progress", "University claimed this signal.");
    } catch {
      // The store already published the notice.
    } finally {
      setBusy(null);
    }
  }

  async function markFixed(issueId: string) {
    setBusy(issueId);
    try {
      await getClient().updateIssueStatus(issueId, "awaiting_verification", note.trim() || "University marked this signal fixed.");
      setNote("");
    } catch {
      // The store already published the notice.
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="wake-signals" aria-label="Fixing list">
      <h2 className="font-display text-lg">Fixing list</h2>
      <p className="mt-1 text-sm text-slate-300">Repeated and urgent signals are listed first. Marking one fixed restores its health.</p>
      {queue.length === 0 ? <p className="mt-4 text-sm">Nothing is waiting on the university.</p> : null}
      <ul className="mt-3 space-y-2">
        {queue.map((issue) => (
          <li key={issue.id} className="rounded-md border border-white/10 bg-black/20 p-3">
            <button type="button" className="w-full text-left" onClick={() => campusStore.selectIssue(issue.id, false)}>
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">
                {severityLabels[issue.severity]} · {issue.reportCount} report{issue.reportCount === 1 ? "" : "s"} · {issue.status.replaceAll("_", " ")}
              </span>
              <span className="mt-1 block text-sm">{issue.summary}</span>
              <span className="mt-1 block text-xs text-slate-400">{categories.find((item) => item.id === issue.category)?.label ?? issue.category}</span>
            </button>
            {issue.status === "open" || issue.status === "reopened" ? (
              <button type="button" className="mt-2" disabled={busy === issue.id} onClick={() => claim(issue.id)}>Claim</button>
            ) : null}
            {issue.status === "in_progress" ? (
              <form
                className="mt-2 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void markFixed(issue.id);
                }}
              >
                <label className="block text-xs text-slate-300" htmlFor={`fix-${issue.id}`}>Update</label>
                <textarea id={`fix-${issue.id}`} value={note} rows={2} placeholder="What was fixed?" onChange={(event) => setNote(event.target.value)} />
                <button type="submit" disabled={busy === issue.id}>Mark fixed</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
