import { cameraView } from "@/lib/config/display";

let bearing = cameraView.bearing;
const listeners = new Set<() => void>();

export function publishBearing(next: number) {
  if (Object.is(bearing, next)) return;
  bearing = next;
  for (const listener of listeners) listener();
}

export function subscribeBearing(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBearing() {
  return bearing;
}
