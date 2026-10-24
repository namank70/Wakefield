"use client";

import { useEffect, useSyncExternalStore } from "react";
import { campusStore } from "@/lib/state/store";

export function useCampus() {
  const snapshot = useSyncExternalStore(campusStore.subscribe, campusStore.getSnapshot, campusStore.getServerSnapshot);
  useEffect(() => {
    campusStore.hydrate();
  }, []);
  return snapshot;
}
