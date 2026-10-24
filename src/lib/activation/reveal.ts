import type { Geometry } from "geojson";
import { categoryContext, evidenceBonusCap, severityWeight } from "@/lib/config/display";
import { metersToGeometry } from "@/lib/geo/distance";
import type { Issue, Report, RevealLevel } from "@/lib/types";

export type LocalReveal = {
  level: RevealLevel;
  score: number;
  urgent: boolean;
  accessibilityFloor: boolean;
  summary: string | null;
  category: string | null;
  severity: Issue["severity"] | null;
  status: Issue["status"] | null;
  issueIds: string[];
};

export type RevealFeature = {
  id: string;
  kind: "building" | "path" | "facility";
  geometry: Geometry;
  landmarkId?: string | null;
};

export type RevealResolver = {
  resolve(feature: RevealFeature, issues: Issue[], reports: Report[]): LocalReveal;
};

const quiet: LocalReveal = {
  level: 0,
  score: 0,
  urgent: false,
  accessibilityFloor: false,
  summary: null,
  category: null,
  severity: null,
  status: null,
  issueIds: [],
};

export function isUnresolved(issue: Issue) {
  return issue.status !== "resolved";
}

export function evidenceBonus(issue: Issue, reports: Report[]) {
  const identities = new Set(reports.filter((report) => report.issueId === issue.id).map((report) => report.reporterId));
  return Math.min(evidenceBonusCap, Math.max(0, identities.size - 1));
}

export function issueScore(issue: Issue, reports: Report[]) {
  if (!isUnresolved(issue)) return 0;
  if (issue.severity === "urgent") return severityWeight.urgent;
  return severityWeight[issue.severity] + evidenceBonus(issue, reports);
}

export function levelForIssue(issue: Issue, reports: Report[]): RevealLevel {
  if (!isUnresolved(issue)) return 0;
  if (issue.severity === "urgent") return 4;
  const score = issueScore(issue, reports);
  let level: RevealLevel = 0;
  if (score >= 10) level = 4;
  else if (score >= 6) level = 3;
  else if (score >= 5) level = 2;
  else if (score >= 3) level = 2;
  else if (score >= 1) level = 1;
  if (issue.accessibilityImpact && level > 0 && level < 3) level = 3;
  if (issue.accessibilityImpact && level === 0) level = 3;
  return level;
}

function featureDistance(issue: Issue, feature: RevealFeature) {
  return metersToGeometry(issue.latitude, issue.longitude, feature.geometry);
}

function affects(issue: Issue, feature: RevealFeature, level: RevealLevel) {
  const rule = categoryContext[issue.category] ?? categoryContext.other;
  const meters = featureDistance(issue, feature);
  if (feature.kind === "building") {
    if (issue.buildingId && (issue.buildingId === feature.id || issue.buildingId === feature.landmarkId)) return true;
    return meters <= rule.buildingRadiusMeters;
  }
  if (feature.kind === "path") {
    if (level >= 4 && rule.contextRadiusMeters > 0) return meters <= rule.contextRadiusMeters;
    if (level >= 2 && rule.pathRadiusMeters > 0) return meters <= rule.pathRadiusMeters;
    return false;
  }
  if (level >= 3 && rule.facilityRadiusMeters > 0) return meters <= rule.facilityRadiusMeters;
  return false;
}

export const prototypeRevealResolver: RevealResolver = {
  resolve(feature, issues, reports) {
    const matches = issues.filter(isUnresolved).flatMap((issue) => {
      const level = levelForIssue(issue, reports);
      if (level === 0 || !affects(issue, feature, level)) return [];
      return [{ issue, level, score: issueScore(issue, reports) }];
    });
    if (matches.length === 0) return quiet;
    const level = Math.max(...matches.map((match) => match.level)) as RevealLevel;
    const primary = matches.reduce((best, match) => (match.level > best.level ? match : best));
    return {
      level,
      score: matches.reduce((sum, match) => sum + match.score, 0),
      urgent: matches.some((match) => match.issue.severity === "urgent"),
      accessibilityFloor: matches.some((match) => match.issue.accessibilityImpact),
      summary: primary.issue.summary,
      category: primary.issue.category,
      severity: primary.issue.severity,
      status: primary.issue.status,
      issueIds: matches.map((match) => match.issue.id),
    };
  },
};

export function revealForIssues(issues: Issue[], reports: Report[]) {
  const open = issues.filter(isUnresolved);
  const score = open.reduce((sum, issue) => sum + issueScore(issue, reports), 0);
  const urgent = open.some((issue) => issue.severity === "urgent");
  const access = open.some((issue) => issue.accessibilityImpact);
  let level: RevealLevel = 0;
  if (urgent) level = 4;
  else if (score >= 10) level = 4;
  else if (score >= 6) level = 3;
  else if (score >= 3) level = 2;
  else if (score >= 1) level = 1;
  if (access && level < 3 && open.length > 0) level = Math.max(level, 3) as RevealLevel;
  return { level, score, urgent };
}
