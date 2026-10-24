"use client";

import { creditBalance, rewards } from "@/lib/health/score";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { useState } from "react";

export function RedeemPanel() {
  const campus = useCampus();
  const balance = creditBalance(campus.credits, "scout-1");
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <section className="wake-report" aria-label="Redeem credits">
      <h2 className="font-display text-lg">Redeem</h2>
      <p className="mt-1 text-sm text-slate-300">Demo catalog only. These are not real campus vendors.</p>
      <p className="mt-3 font-mono text-sm text-cyan">{balance} credits</p>
      <ul className="mt-3 space-y-2">
        {rewards.map((reward) => (
          <li key={reward.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3">
            <span>
              <span className="block text-sm">{reward.label}</span>
              <span className="font-mono text-[10px] text-slate-400">{reward.cost} credits</span>
            </span>
            <button
              type="button"
              disabled={busy === reward.id || balance < reward.cost}
              onClick={() => {
                setBusy(reward.id);
                try {
                  campusStore.redeem("scout-1", reward.id);
                } catch {
                  // The store already published the notice.
                } finally {
                  setBusy(null);
                }
              }}
            >
              Redeem
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
