"use client";

import { revealLabels } from "@/lib/config/display";
import { campusStore } from "@/lib/state/store";
import type { RevealLevel } from "@/lib/types";

const levels: RevealLevel[] = [0, 1, 2, 3, 4];

export function DemoControls() {
  return (
    <details className="wake-demo">
      <summary>Demo data</summary>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <button type="button" onClick={() => campusStore.reset()}>Reset</button>
        <button type="button" onClick={() => campusStore.addLibrarySignal()}>Add Library signal</button>
        <button type="button" onClick={() => campusStore.addIndependentEvidence()}>Add independent supporting evidence</button>
        <button type="button" onClick={() => campusStore.addNearbyIssue()}>Add nearby distinct issue</button>
        <button type="button" onClick={() => campusStore.addUrgentIssue()}>Trigger urgent issue</button>
        <div className="flex flex-wrap gap-1">
          {levels.map((level) => (
            <button key={level} type="button" onClick={() => campusStore.setPreview(level)}>
              {revealLabels[level]}
            </button>
          ))}
          <button type="button" onClick={() => campusStore.setPreview(null)}>Clear preview</button>
        </div>
        <p className="text-xs text-slate-300">Preview changes the Library footprint only. It does not write reports.</p>
      </div>
    </details>
  );
}
