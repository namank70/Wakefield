import { namedBuildings } from "@/lib/geo/campus";
import { metersBetween } from "@/lib/geo/distance";
import { landmarks } from "@/data/geo/landmarks";
import type { Issue, Severity } from "@/lib/types";

const damageBySeverity: Record<Severity, number> = {
  low: 5,
  medium: 15,
  high: 30,
  urgent: 50,
};

const severityRank: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const ladder: Severity[] = ["low", "medium", "high", "urgent"];

export type CampusPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

function shortName(name: string) {
  return name
    .replace("Dr. Martin Luther King Jr. Library", "MLK Library")
    .replace("Charles W. Davidson College of Engineering", "Engineering")
    .replace("Diaz Compean Student Union", "Student Union");
}

export const campusPlaces: CampusPlace[] = [
  ...landmarks.map((landmark) => ({
    id: landmark.id,
    name: shortName(landmark.name),
    latitude: landmark.latitude,
    longitude: landmark.longitude,
  })),
  ...namedBuildings
    .filter((building) => building.band === "campus")
    .map((building) => ({
      id: building.id,
      name: building.name,
      latitude: building.latitude,
      longitude: building.longitude,
    })),
];

export function hurtsHealth(issue: Issue) {
  return issue.status === "open" || issue.status === "in_progress" || issue.status === "reopened";
}

export function issueDamage(issue: Issue) {
  if (!hurtsHealth(issue)) return 0;
  const extra = Math.min(10, Math.max(0, issue.reportCount - 1) * 2);
  return damageBySeverity[issue.severity] + extra;
}

export function placeForIssue(issue: Issue) {
  const direct = campusPlaces.find((place) => place.id === issue.buildingId);
  if (direct) return direct;
  let best = campusPlaces[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const place of campusPlaces) {
    const meters = metersBetween(issue.latitude, issue.longitude, place.latitude, place.longitude);
    if (meters < bestDistance) {
      best = place;
      bestDistance = meters;
    }
  }
  return best;
}

export function stepSeverity(issue: Issue): Issue {
  if (issue.reportCount < 3 || issue.escalated) return issue;
  const index = ladder.indexOf(issue.severity);
  const severity = ladder[Math.min(ladder.length - 1, index + 1)];
  return { ...issue, severity, escalated: true };
}

export type BuildingHealth = CampusPlace & { health: number };

export function buildingHealth(issues: Issue[]): BuildingHealth[] {
  const damage = new Map<string, number>();
  for (const issue of issues) {
    const amount = issueDamage(issue);
    if (amount === 0) continue;
    const place = placeForIssue(issue);
    damage.set(place.id, (damage.get(place.id) ?? 0) + amount);
  }
  return campusPlaces.map((place) => ({
    ...place,
    health: Math.max(0, 100 - (damage.get(place.id) ?? 0)),
  }));
}

export function campusHealth(issues: Issue[]) {
  const scores = buildingHealth(issues);
  if (scores.length === 0) return 100;
  const mean = scores.reduce((sum, place) => sum + place.health, 0) / scores.length;
  return Math.floor(mean);
}

export function healthTone(health: number) {
  if (health >= 80) return "#26D9FF";
  if (health >= 55) return "#8B5CF6";
  if (health >= 30) return "#FFB547";
  return "#FF4057";
}

export function fixingOrder(issues: Issue[]) {
  const rank = (issue: Issue) => (issue.status === "awaiting_verification" ? 0 : 1);
  return issues
    .filter((issue) => issue.status !== "resolved")
    .slice()
    .sort((a, b) => {
      const group = rank(b) - rank(a);
      if (group !== 0) return group;
      const severity = severityRank[b.severity] - severityRank[a.severity];
      if (severity !== 0) return severity;
      if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export const rewards = [
  { id: "coffee", label: "Student Union coffee", cost: 40 },
  { id: "snack", label: "Campus market snack", cost: 30 },
  { id: "print", label: "Library print credit", cost: 25 },
  { id: "parking", label: "Parking day pass", cost: 80 },
] as const;

export type RewardId = (typeof rewards)[number]["id"];

export function creditBalance(events: { actorId: string; delta: number }[], actorId: string) {
  return events.filter((event) => event.actorId === actorId).reduce((sum, event) => sum + event.delta, 0);
}
