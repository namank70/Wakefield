"use client";

import { useEffect, useSyncExternalStore } from "react";
import { dataMode } from "@/lib/config/env";
import { getClient } from "@/lib/api";
import { campusStore } from "@/lib/state/store";

export function useCampus() {
  const snapshot = useSyncExternalStore(campusStore.subscribe, campusStore.getSnapshot, campusStore.getServerSnapshot);
  useEffect(() => {
    campusStore.hydrate();
    if (dataMode === "live") {
      void getClient().getMapState().then((state) => campusStore.replaceFromMapState(state)).catch(() => {
        // Keep the local snapshot visible if the API is temporarily unavailable.
      });
    }
    const refresh = () => {
      if (dataMode === "live") void getClient().getMapState().then((state) => campusStore.replaceFromMapState(state));
    };
    window.addEventListener("wakefield:data-changed", refresh);
    return () => window.removeEventListener("wakefield:data-changed", refresh);
  }, []);
  return snapshot;
}
