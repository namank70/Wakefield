"use client";

import { categories, severityLabels } from "@/lib/config/display";
import { fixingOrder, issuePriorityScore } from "@/lib/health/score";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";

export function SignalList() {
  const campus = useCampus();
  const open = fixingOrder(campus.issues);
  return (
    <section className="wake-signals" aria-label="Priority queue">
      <h2 className="font-display text-lg">Priority queue</h2>
      <p className="mt-1 text-sm text-slate-300">
        Repeat reports raise priority. Urgency and accessibility impact count too.
      </p>
      {open.length === 0 ? <p className="mt-4 text-sm">No open signals on the map.</p> : null}
      <ul className="mt-3 space-y-2">
        {open.map((issue) => (
          <li key={issue.id}>
            <button type="button" className="w-full rounded-md border border-white/10 bg-black/20 p-3 text-left" onClick={() => campusStore.selectIssue(issue.id, true)}>
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">
                PRIORITY {issuePriorityScore(issue)} · {severityLabels[issue.severity]} · {issue.reportCount} report{issue.reportCount === 1 ? "" : "s"}
              </span>
              <span className="mt-1 block text-sm">{issue.summary}</span>
              <span className="mt-1 block text-xs text-slate-400">{categories.find((item) => item.id === issue.category)?.label ?? issue.category} · {issue.status.replaceAll("_", " ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
