"use client";

import { fixingOrder, issuePriorityScore, creditBalance } from "@/lib/health/score";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { Activity, ArrowUpRight, Award, Camera, ListOrdered, MapPinned, RotateCcw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useVisionStatus } from "@/lib/state/use-vision";
import { testPhotos } from "@/lib/demo/scenarios";
import { analyzePhotoSequence, type SequenceProgress } from "@/lib/api/photo-sequence";

export function DemoControls() {
  const campus = useCampus();
  const { status, refresh } = useVisionStatus();
  const [sequence, setSequence] = useState<SequenceProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stop = useRef(false);
  const active = useRef(false);
  const openCount = campus.issues.filter((issue) => issue.status !== "resolved").length;
  const priorityQueue = fixingOrder(campus.issues);
  const topPriority = priorityQueue[0] ?? null;
  const aisleIssue = campus.issues
    .filter((issue) => issue.category === "walkway_obstruction" && issue.accessibilityImpact && issue.status !== "resolved")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const points = creditBalance(campus.credits, "scout-1");

  async function analyzeArea(area: string) {
    if (active.current) return;
    active.current = true; stop.current = false;
    setRunning(true); setMessage(null);
    const photos = testPhotos.filter((photo) => photo.synthetic && (area === "all" || photo.regionId === area));
    try {
      const result = await analyzePhotoSequence(photos, setSequence, () => stop.current);
      setMessage(`${stop.current ? "Stopped" : "Complete"}: ${result.saved} reports saved; ${result.skipped} clear or already-added photos skipped.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Photo AI could not finish this set. You can retry the remaining photos.");
      void refresh();
    } finally { active.current = false; setRunning(false); }
  }

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
      <p className={`wake-ai-status ${status?.ready ? "is-ready" : ""}`} title={status?.message} role="status">{status ? status.ready ? "Photo AI connected" : "Photo AI unavailable · manual review available" : "Checking photo AI…"}</p>
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
        <p className="wake-demo-footnote">AI test sets add detected issues to this browser&apos;s queue as each photo finishes.</p>
        <button className="wake-demo-action" type="button" disabled={!campus.ready || !status?.ready || running} onClick={() => void analyzeArea("library")}>
          <Sparkles size={14} /> Analyze Library photo set · 3
        </button>
        <button className="wake-demo-action" type="button" disabled={!campus.ready || !status?.ready || running} onClick={() => void analyzeArea("engineering")}>
          <Sparkles size={14} /> Analyze Engineering photo set · 3
        </button>
        <button className="wake-demo-action" type="button" disabled={!campus.ready || !status?.ready || running} onClick={() => void analyzeArea("all")}>
          <Sparkles size={14} /> Analyze all generated photos · 8
        </button>
        {sequence ? <div className="wake-ai-batch" role="status"><progress value={sequence.completed} max={sequence.total} /><span>{sequence.completed}/{sequence.total} · {running ? sequence.title : "Photos reviewed"}</span>{running ? <button type="button" onClick={() => { stop.current = true; }}>Stop after this photo</button> : null}</div> : null}
        {message ? <p className="wake-ai-batch-message" role="status">{message}</p> : null}
        <button className="wake-demo-action" type="button" disabled={!campus.ready || running} onClick={() => campusStore.loadDemoStory()}>
          <Sparkles size={14} /> Original four-photo sequence · saved labels
        </button>
        <button className="wake-demo-action" type="button" disabled={!campus.ready || running || !aisleIssue || aisleIssue.reportCount >= 3} onClick={() => aisleIssue && campusStore.addIndependentEvidence(aisleIssue.id)}>
          <span>＋</span> Add an independent confirmation
        </button>
        <button className="wake-demo-reset" type="button" disabled={!campus.ready || running} onClick={() => { campusStore.reset(); setSequence(null); setMessage(null); }}>
          <RotateCcw size={13} /> Reset campus activity
        </button>
      </details>
      <p className="wake-demo-footnote">Photo AI suggests urgency and the receiving team. Review before saving. Generated photos are test scenes; reward codes are in-app claims.</p>
    </section>
  );
}
