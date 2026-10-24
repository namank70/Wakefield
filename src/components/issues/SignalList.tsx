"use client";

import { categories, severityLabels } from "@/lib/config/display";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";

export function SignalList() {
  const campus = useCampus();
  const open = campus.issues.filter((issue) => issue.status !== "resolved");
  return (
    <section className="wake-signals" aria-label="Open signals">
      <h2 className="font-display text-lg">Signals</h2>
      <p className="mt-1 text-sm text-slate-300">
        Quiet means few recent reports. It does not mean a place has been verified safe.
      </p>
      {open.length === 0 ? <p className="mt-4 text-sm">No open signals on the map.</p> : null}
      <ul className="mt-3 space-y-2">
        {open.map((issue) => (
          <li key={issue.id}>
            <button type="button" className="w-full rounded-md border border-white/10 bg-black/20 p-3 text-left" onClick={() => campusStore.selectIssue(issue.id, true)}>
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">
                {severityLabels[issue.severity]} · {categories.find((item) => item.id === issue.category)?.label ?? issue.category}
              </span>
              <span className="mt-1 block text-sm">{issue.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
