"use client";

import { fixingOrder, issuePriorityScore, creditBalance } from "@/lib/health/score";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { Activity, ArrowUpRight, Award, Camera, ListOrdered, MapPinned, RotateCcw, Sparkles } from "lucide-react";

export function DemoControls() {
  const campus = useCampus();
  const openCount = campus.issues.filter((issue) => issue.status !== "resolved").length;
  const priorityQueue = fixingOrder(campus.issues);
  const topPriority = priorityQueue[0] ?? null;
  const aisleIssue = campus.issues
    .filter((issue) => issue.category === "walkway_obstruction" && issue.accessibilityImpact && issue.status !== "resolved")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const points = creditBalance(campus.credits, "scout-1");

  return (
    <section className="wake-demo" aria-label="Wakefield campus pulse">
      <div className="wake-demo-heading">
        <span className="wake-demo-mascot" aria-hidden="true"><Sparkles size={17} /></span>
        <div className="min-w-0">
          <p className="wake-demo-eyebrow">WAKEFIELD · SJSU</p>
          <p className="wake-demo-title">When the campus speaks,<br />the campus wakes.</p>
        </div>
      </div>
      <p className="wake-demo-copy">One shared view for student reports, campus response, and visible progress.</p>
      <div className="wake-demo-metrics" aria-label="Campus pulse">
        <span><Activity size={13} /><b>{openCount}</b> open</span>
        <span><MapPinned size={13} /><b>{priorityQueue.length}</b> queued</span>
        <span><Award size={13} /><b>{points}</b> pts</span>
      </div>
      {topPriority ? (
        <div className="wake-priority-spotlight">
          <div className="wake-priority-topline">
            <span><ListOrdered size={13} /> TOP PRIORITY</span>
            <b>{issuePriorityScore(topPriority)}</b>
          </div>
          <button type="button" onClick={() => campusStore.selectIssue(topPriority.id, true)}>
            {topPriority.summary}<ArrowUpRight size={14} />
          </button>
          <small>{topPriority.reportCount} report{topPriority.reportCount === 1 ? "" : "s"} · {topPriority.severity} · {topPriority.accessibilityImpact ? "access route impact" : "campus issue"}</small>
        </div>
      ) : (
        <p className="wake-priority-empty">The priority queue is clear. Be the first to report a campus issue.</p>
      )}
      <button className="wake-demo-primary" type="button" disabled={!campus.ready} onClick={() => campusStore.openReport()}>
        <Camera size={15} /> Report a signal
      </button>
      <button className="wake-demo-action" type="button" disabled={!campus.ready} onClick={() => campusStore.setPanel("signals")}>
        <ListOrdered size={14} /> Open priority queue
      </button>
      <details className="wake-guided-actions">
        <summary>Presentation controls</summary>
        <button className="wake-demo-action" type="button" disabled={!campus.ready} onClick={() => campusStore.loadDemoStory()}>
          <Sparkles size={14} /> Add the four-photo sequence
        </button>
        <button className="wake-demo-action" type="button" disabled={!campus.ready || !aisleIssue || aisleIssue.reportCount >= 3} onClick={() => aisleIssue && campusStore.addIndependentEvidence(aisleIssue.id)}>
          <span>＋</span> Add an independent confirmation
        </button>
        <button className="wake-demo-reset" type="button" disabled={!campus.ready} onClick={() => campusStore.reset()}>
          <RotateCcw size={13} /> Reset campus activity
        </button>
      </details>
      <p className="wake-demo-footnote">Prepared photos use saved classifications. Other uploads need a manual review unless a live image provider is configured. Reward codes are in-app claims.</p>
    </section>
  );
}
