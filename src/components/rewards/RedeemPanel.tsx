"use client";

import { creditBalance, rewards } from "@/lib/health/score";
import { campusStore } from "@/lib/state/store";
import { useCampus } from "@/lib/state/use-campus";
import { useState } from "react";

export function RedeemPanel() {
  const campus = useCampus();
  const balance = creditBalance(campus.credits, "scout-1");
  const vouchers = campus.credits
    .filter((event) => event.actorId === "scout-1" && event.reason === "redeem")
    .slice()
    .reverse();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <section className="wake-report" aria-label="Impact points rewards">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan">SCOUT REWARDS</p>
      <h2 className="font-display text-xl">Rewards</h2>
      <p className="mt-1 text-sm text-slate-300">Claiming deducts points and creates a code in your Wakefield account. Campus vendor fulfilment is not connected yet.</p>
      <p className="mt-3 font-mono text-sm text-cyan">{balance} impact points</p>
      <ul className="mt-3 space-y-2">
        {rewards.map((reward) => (
          <li key={reward.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3">
            <span>
              <span className="block text-sm">{reward.label}</span>
              <span className="font-mono text-[10px] text-slate-400">{reward.cost} points</span>
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
              Claim
            </button>
          </li>
        ))}
      </ul>
      {vouchers.length > 0 ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="font-display text-base">Your claimed rewards</h3>
          <ul className="mt-2 space-y-2">
            {vouchers.map((voucher) => (
              <li key={voucher.id} className="flex items-center justify-between gap-3 rounded-md border border-emerald-300/20 bg-emerald-300/5 p-3">
                <span className="text-sm">{voucher.label}</span>
                <code className="shrink-0 font-mono text-xs text-emerald-200">WAKE-{voucher.id.slice(-6).toUpperCase()}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
