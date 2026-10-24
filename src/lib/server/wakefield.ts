import type {
  AnalysisResult,
  CreateReportInput,
  CreateReportResponse,
  DuplicateInput,
  DuplicateSuggestion,
  Issue,
  IssueDetail,
  IssueStatus,
  MapState,
  PhotoEvidence,
  RegionState,
  Report,
  StatusEvent,
  UploadResult,
  VerificationInput,
} from "@/lib/types";

type StoredPhoto = { blob: Blob; campusId: string; imagePath: string; createdAt: string };

const regions = [
  { id: "library", name: "MLK Library" },
  { id: "student-union", name: "Student Union" },
  { id: "engineering", name: "Engineering" },
  { id: "main-campus", name: "Main Campus" },
] as const;

const photos = new Map<string, StoredPhoto>();
const issues = new Map<string, Issue>();
const reports = new Map<string, Report>();
const photoEvidence = new Map<string, PhotoEvidence>();
const events: StatusEvent[] = [];
const analysisCache = new Map<string, AnalysisResult>();

const severityScore = { low: 1, medium: 2, high: 3, urgent: 10 } as const;
const unresolved = new Set<IssueStatus>(["open", "in_progress", "awaiting_verification"]);
const transitions: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress"],
  in_progress: ["awaiting_verification"],
  awaiting_verification: ["resolved", "reopened"],
  resolved: [],
  reopened: ["in_progress"],
};

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function jsonError(message: string, status = 400): never {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  throw error;
}

function regionState(regionId: string): RegionState {
  const region = regions.find((item) => item.id === regionId) ?? regions[3];
  const localIssues = [...issues.values()].filter((issue) => issue.regionId === regionId && unresolved.has(issue.status));
  const score = localIssues.reduce((total, issue) => total + severityScore[issue.severity] + (issue.accessibilityImpact ? 2 : 0), 0);
  return {
    id: region.id,
    name: region.name,
    activationScore: score,
    activationThreshold: 5,
    active: score >= 5 || localIssues.some((issue) => issue.severity === "urgent"),
  };
}

function normalizeCategory(value: unknown) {
  const category = String(value || "other").trim().toLowerCase().replace(/[ -]+/g, "_");
  return category === "blocked_pathway" ? "walkway_obstruction" : category;
}

function normalizeAnalysis(value: Partial<AnalysisResult>, provider: AnalysisResult["provider"]): AnalysisResult {
  const confidence = Number(value.confidence ?? 0);
  return {
    category: normalizeCategory(value.category),
    summary: String(value.summary || "Issue identified from submitted image"),
    severity: value.severity === "low" || value.severity === "medium" || value.severity === "high" || value.severity === "urgent" ? value.severity : "medium",
    department: String(value.department || "Campus services"),
    confidence: Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)),
    accessibilityImpact: Boolean(value.accessibilityImpact),
    tags: Array.isArray(value.tags) ? value.tags.map(String).slice(0, 12) : [],
    provider,
  };
}

export async function uploadPhoto(blob: Blob, campusId: string): Promise<UploadResult> {
  if (!blob.type.startsWith("image/")) jsonError("Only image files are supported.", 415);
  if (blob.size > 10 * 1024 * 1024) jsonError("Image exceeds the 10 MB limit.", 413);
  const photoId = id("photo");
  const imagePath = `session/${campusId}/${photoId}`;
  photos.set(photoId, { blob, campusId, imagePath, createdAt: now() });
  return { photoId, imagePath, storage: "session" };
}

export async function analyzePhoto(photoId: string, context: { campusId: string; latitude?: number; longitude?: number; regionId?: string; buildingId?: string }) {
  const stored = photos.get(photoId);
  if (!stored) jsonError("Photo not found.", 404);
  const existing = analysisCache.get(photoId);
  if (existing) return existing;

  if (process.env.EAISER_API_URL) {
    const body = new FormData();
    body.append("image", new Blob([await stored.blob.arrayBuffer()], { type: stored.blob.type }), photoId);
    body.append("context", JSON.stringify(context));
    const response = await fetch(process.env.EAISER_API_URL, {
      method: "POST",
      headers: process.env.EAISER_API_KEY ? { Authorization: `Bearer ${process.env.EAISER_API_KEY}` } : undefined,
      body,
    });
    if (!response.ok) jsonError(`EAiSER analysis failed (${response.status}).`, 502);
    const result = normalizeAnalysis((await response.json()) as Partial<AnalysisResult>, "eaiser");
    analysisCache.set(photoId, result);
    return result;
  }

  const cached = normalizeAnalysis({
    category: "bike_scooter_parking",
    summary: "Bikes and scooters are blocking the pedestrian route",
    severity: "high",
    department: "Transportation and Parking Services",
    confidence: 0.92,
    accessibilityImpact: true,
    tags: ["blocked-path", "bike", "scooter"],
  }, "cached");
  analysisCache.set(photoId, cached);
  return cached;
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radius = 6371000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function suggestDuplicate(input: DuplicateInput): DuplicateSuggestion | null {
  const candidate = [...issues.values()]
    .filter((issue) => issue.category === normalizeCategory(input.category) && unresolved.has(issue.status))
    .map((issue) => ({ issue, distance: distanceMeters(input.latitude, input.longitude, issue.latitude, issue.longitude) }))
    .filter(({ issue, distance }) => distance <= 30 && Date.now() - Date.parse(issue.createdAt) < 24 * 60 * 60 * 1000)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!candidate) return null;
  return { issueId: candidate.issue.id, summary: candidate.issue.summary, category: candidate.issue.category, severity: candidate.issue.severity, distanceMeters: Math.round(candidate.distance), reportCount: candidate.issue.reportCount, createdAt: candidate.issue.createdAt };
}

export function createReport(input: CreateReportInput): CreateReportResponse {
  if (!input.campusId || !input.regionId || !input.analysis || !input.reporterId) jsonError("campusId, regionId, analysis, and reporterId are required.");
  const timestamp = now();
  const category = normalizeCategory(input.analysis.category);
  const existing = input.attachToIssueId ? issues.get(input.attachToIssueId) : undefined;
  const duplicate = Boolean(existing);
  const issue = existing ?? {
    id: id("issue"), campusId: input.campusId, regionId: input.regionId, buildingId: input.buildingId,
    category, summary: input.analysis.summary, severity: input.analysis.severity, department: input.analysis.department,
    status: "open" as const, latitude: input.latitude, longitude: input.longitude, accessibilityImpact: input.analysis.accessibilityImpact,
    reportCount: 0, tags: input.analysis.tags, createdAt: timestamp, updatedAt: timestamp, resolvedAt: null,
  };
  const reportId = id("report");
  const report: Report = { id: reportId, issueId: issue.id, reporterId: input.reporterId, photoId: input.photoId, latitude: input.latitude, longitude: input.longitude, locationSource: input.locationSource, locationAccuracyMeters: input.locationAccuracyMeters, studentDescription: input.studentDescription, aiConfidence: input.analysis.confidence, analysisProvider: input.analysis.provider, createdAt: timestamp };
  issue.reportCount += 1;
  issue.updatedAt = timestamp;
  issues.set(issue.id, issue);
  reports.set(report.id, report);
  if (input.photoId) photoEvidence.set(input.photoId, { id: id("evidence"), issueId: issue.id, reportId: report.id, kind: duplicate ? "evidence" : "before", storagePath: photos.get(input.photoId)?.imagePath ?? input.photoId, createdAt: timestamp });
  events.push({ id: id("event"), issueId: issue.id, actorId: input.reporterId, actorRole: "student", fromStatus: duplicate ? issue.status : null, toStatus: issue.status, note: duplicate ? "Evidence added to an existing signal." : "Signal submitted.", createdAt: timestamp });
  return { reportId, issueId: issue.id, duplicate, matchedIssueId: duplicate ? issue.id : null, reportCount: issue.reportCount, region: regionState(issue.regionId), analysis: { ...input.analysis, category } };
}

export function mapState(): MapState {
  return { campusId: "sjsu", regions: regions.map((region) => regionState(region.id)), issues: [...issues.values()], reports: [...reports.values()], photos: [...photoEvidence.values()], events: [...events] };
}

export function issueDetail(issueId: string): IssueDetail {
  const issue = issues.get(issueId);
  if (!issue) jsonError("Issue not found.", 404);
  return { ...issue, reports: [...reports.values()].filter((report) => report.issueId === issueId), photos: [...photoEvidence.values()].filter((photo) => photo.issueId === issueId), events: events.filter((event) => event.issueId === issueId), independentReporterCount: new Set([...reports.values()].filter((report) => report.issueId === issueId).map((report) => report.reporterId)).size, region: regionState(issue.regionId) };
}

export function updateIssueStatus(issueId: string, status: IssueStatus, note = "") {
  const issue = issues.get(issueId);
  if (!issue) jsonError("Issue not found.", 404);
  if (!transitions[issue.status].includes(status)) jsonError(`Cannot change issue from ${issue.status} to ${status}.`, 409);
  const timestamp = now();
  const previous = issue.status;
  issue.status = status;
  issue.updatedAt = timestamp;
  issue.resolvedAt = status === "resolved" ? timestamp : issue.resolvedAt;
  events.push({ id: id("event"), issueId, actorId: "responder-1", actorRole: "university", fromStatus: previous, toStatus: status, note: note || "Issue status updated.", createdAt: timestamp });
  return issueDetail(issueId);
}

export function verifyIssue(issueId: string, input: VerificationInput) {
  const next: IssueStatus = input.confirmed ? "resolved" : "reopened";
  const result = updateIssueStatus(issueId, next, input.confirmed ? "Student verified the repair." : "Student reported the repair incomplete.");
  return result;
}
