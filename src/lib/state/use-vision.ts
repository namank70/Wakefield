"use client";

import { fetchVisionStatus, type VisionStatus } from "@/lib/api/vision";
import { useSyncExternalStore } from "react";

let status: VisionStatus | null = null;
let timer: number | null = null;
const listeners = new Set<() => void>();
async function refresh() {
  try { status = await fetchVisionStatus(); }
  catch { status = { ready: false, provider: "ollama", model: null, message: "Photo AI status is unavailable. Try again or use manual review." }; }
  for (const listener of listeners) listener();
}
const onFocus = () => { void refresh(); };
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    void refresh();
    timer = window.setInterval(() => void refresh(), 15_000);
    window.addEventListener("focus", onFocus);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== null) {
      window.clearInterval(timer); timer = null;
      window.removeEventListener("focus", onFocus);
    }
  };
}
const snapshot = () => status;
const serverSnapshot = () => null;
export function useVisionStatus() {
  return { status: useSyncExternalStore(subscribe, snapshot, serverSnapshot), refresh };
}
