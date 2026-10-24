import type { RevealLevel, Severity } from "@/lib/types";

export const campusId = "sjsu";

export const activationThreshold = 5;

export const duplicateRule = {
  maxDistanceMeters: 30,
  maxAgeHours: 24,
};

export const evidenceBonusCap = 2;

export const severityWeight: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 10,
};

export const categories = [
  { id: "lighting", label: "Lighting", department: "Facilities Electrical" },
  { id: "walkway_obstruction", label: "Walkway obstruction", department: "Facilities" },
  { id: "trash_overflow", label: "Trash overflow", department: "Custodial Services" },
  { id: "bike_scooter_parking", label: "Bike and scooter parking", department: "Transportation and Parking Services" },
  { id: "water_leak", label: "Water leak", department: "Facilities Plumbing" },
  { id: "door_lock", label: "Door or lock", department: "Facilities Lock Shop" },
  { id: "printer_technology", label: "Printer or technology", department: "Campus IT" },
  { id: "accessibility_barrier", label: "Accessibility barrier", department: "Accessibility and Facilities" },
  { id: "other", label: "Other", department: "Manual review" },
] as const;

export type CategoryId = (typeof categories)[number]["id"];

export type ContextRule = {
  buildingRadiusMeters: number;
  pathRadiusMeters: number;
  contextRadiusMeters: number;
  facilityRadiusMeters: number;
};

export const categoryContext: Record<string, ContextRule> = {
  lighting: { buildingRadiusMeters: 30, pathRadiusMeters: 25, contextRadiusMeters: 40, facilityRadiusMeters: 20 },
  walkway_obstruction: { buildingRadiusMeters: 18, pathRadiusMeters: 35, contextRadiusMeters: 50, facilityRadiusMeters: 30 },
  trash_overflow: { buildingRadiusMeters: 25, pathRadiusMeters: 15, contextRadiusMeters: 25, facilityRadiusMeters: 15 },
  bike_scooter_parking: { buildingRadiusMeters: 22, pathRadiusMeters: 40, contextRadiusMeters: 55, facilityRadiusMeters: 40 },
  water_leak: { buildingRadiusMeters: 28, pathRadiusMeters: 20, contextRadiusMeters: 30, facilityRadiusMeters: 15 },
  door_lock: { buildingRadiusMeters: 20, pathRadiusMeters: 0, contextRadiusMeters: 12, facilityRadiusMeters: 20 },
  printer_technology: { buildingRadiusMeters: 18, pathRadiusMeters: 0, contextRadiusMeters: 0, facilityRadiusMeters: 0 },
  accessibility_barrier: { buildingRadiusMeters: 24, pathRadiusMeters: 30, contextRadiusMeters: 40, facilityRadiusMeters: 35 },
  other: { buildingRadiusMeters: 22, pathRadiusMeters: 20, contextRadiusMeters: 30, facilityRadiusMeters: 15 },
};

export const regionNames: Record<string, string> = {
  library: "MLK Library",
  "student-union": "Student Union",
  engineering: "Engineering",
  "main-campus": "Main Campus",
};

export const revealLabels: Record<RevealLevel, string> = {
  0: "Quiet",
  1: "Signal",
  2: "Emerging",
  3: "Active",
  4: "Intensive",
};

export const severityLabels: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const mapZoom = {
  clusterBelow: 17,
  namesAt: 16,
  evidenceAt: 18,
  max: 20,
};

export const cameraView = {
  pitch: 50,
  bearing: 18,
};

/** Visual scale for the pitched map, not surveyed building heights. */
export const extrusionMeters: Record<RevealLevel, number> = {
  0: 0,
  1: 12,
  2: 18,
  3: 36,
  4: 48,
};

export const colors = {
  background: "#070B14",
  panel: "#10182A",
  line: "#5C7394",
  path: "#3D4F66",
  cyan: "#26D9FF",
  violet: "#8B5CF6",
  amber: "#FFB547",
  urgent: "#FF4057",
};
