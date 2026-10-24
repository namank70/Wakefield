import { bearing, destination, point } from "@turf/turf";
import { evidenceBonus, isUnresolved, revealForIssues } from "@/lib/activation/reveal";
import { clearPreviews, previewUrl, readBlobWithProgress, rememberPreview } from "@/lib/api/images";
import { activationThreshold, campusId, duplicateRule } from "@/lib/config/display";
import { creditBalance, rewards, stepSeverity } from "@/lib/health/score";
import { isInsideReporting, landmarks, metersBetween, nearestLandmark, regionIdFor, regionNameFor, seededLibraryPin } from "@/lib/geo/campus";
import type {
  AnalysisResult,
  CreateReportInput,
  CreateReportResponse,
  DuplicateInput,
  DuplicateSuggestion,
  CreditEvent,
  Issue,
  IssueDetail,
  IssueStatus,
  LocationSource,
  MapState,
  PhotoEvidence,
  RegionState,
  Report,
  RevealLevel,
  StatusEvent,
  UploadProgress,
  UploadResult,
  VerificationInput,
} from "@/lib/types";

const storageKey = "wakefield.mock.v1";

type Persisted = {
  issues: Issue[];
  reports: Report[];
  photos: PhotoEvidence[];
  events: StatusEvent[];
  credits: CreditEvent[];
};

export type Desk = "student" | "university";

type ViewCommand = {
  id: number;
  kind: "fit" | "fly" | "zoom-in" | "zoom-out" | "rotate" | "reset-pose";
  latitude?: number;
  longitude?: number;
  zoom?: number;
};

export type DraftLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: LocationSource;
};

export type CampusSnapshot = Persisted & {
  ready: boolean;
  selectedIssueId: string | null;
  panel: "map" | "signals" | "fixing" | "redeem";
  desk: Desk;
  previewLevel: RevealLevel | null;
  pendingSignalId: string | null;
  notice: string | null;
  viewCommand: ViewCommand | null;
  placingPin: boolean;
  draftLocation: DraftLocation | null;
  reportOpen: boolean;
};

const emptyPersisted = (): Persisted => ({ issues: [], reports: [], photos: [], events: [], credits: [] });

let persisted: Persisted = emptyPersisted();
let ready = false;
let selectedIssueId: string | null = null;
let panel: CampusSnapshot["panel"] = "map";
let desk: Desk = "student";
let previewLevel: RevealLevel | null = null;
let pendingSignalId: string | null = null;
let notice: string | null = null;
let viewCommand: ViewCommand | null = null;
let placingPin = false;
let draftLocation: DraftLocation | null = null;
let reportOpen = false;
let commandId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function snapshot(): CampusSnapshot {
  return {
    ready,
    ...persisted,
    selectedIssueId,
    panel,
    desk,
    previewLevel,
    pendingSignalId,
    notice,
    viewCommand,
    placingPin,
    draftLocation,
    reportOpen,
  };
}

const serverSnapshot: CampusSnapshot = {
  ready: false,
  issues: [],
  reports: [],
  photos: [],
  events: [],
  selectedIssueId: null,
  panel: "map",
  desk: "student",
  credits: [],
  previewLevel: null,
  pendingSignalId: null,
  notice: null,
  viewCommand: null,
  placingPin: false,
  draftLocation: null,
  reportOpen: false,
};

let cached: CampusSnapshot = serverSnapshot;

function publish() {
  cached = snapshot();
  emit();
}

function save() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(persisted));
}

function load(): Persisted {
  if (typeof window === "undefined") return emptyPersisted();
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return emptyPersisted();
  try {
    const parsed = JSON.parse(raw) as Persisted;
    return {
      issues: parsed.issues ?? [],
      reports: parsed.reports ?? [],
      photos: parsed.photos ?? [],
      events: parsed.events ?? [],
      credits: parsed.credits ?? [],
    };
  } catch {
    return emptyPersisted();
  }
}

function nid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

const transitions: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress"],
  in_progress: ["awaiting_verification"],
  awaiting_verification: ["resolved", "reopened"],
  resolved: [],
  reopened: ["in_progress"],
};

function credit(actorId: string, issueId: string | null, reason: CreditEvent["reason"], delta: number, label: string): CreditEvent {
  return { id: nid("credit"), actorId, issueId, reason, delta, label, createdAt: new Date().toISOString() };
}

function regionState(regionId: string): RegionState {
  const localIssues = persisted.issues.filter((issue) => issue.regionId === regionId);
  const summary = revealForIssues(localIssues, persisted.reports);
  return {
    id: regionId,
    name: regionNameFor(regionId),
    activationScore: summary.score,
    activationThreshold,
    active: summary.score >= activationThreshold || summary.urgent,
  };
}

function mapState(): MapState {
  const regionIds = ["library", "student-union", "engineering", "main-campus"];
  return {
    campusId,
    regions: regionIds.map(regionState),
    issues: persisted.issues,
    reports: persisted.reports,
    photos: persisted.photos,
    events: persisted.events,
  };
}

function issueDetail(issueId: string): IssueDetail {
  const issue = persisted.issues.find((item) => item.id === issueId);
  if (!issue) throw new Error("Signal not found");
  const reports = persisted.reports.filter((report) => report.issueId === issue.id);
  return {
    ...issue,
    reports,
    photos: persisted.photos.filter((photo) => photo.issueId === issue.id),
    events: persisted.events.filter((event) => event.issueId === issue.id),
    independentReporterCount: new Set(reports.map((report) => report.reporterId)).size,
    region: regionState(issue.regionId),
  };
}

export const campusStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return cached;
  },
  getServerSnapshot() {
    return serverSnapshot;
  },
  hydrate() {
    if (ready || typeof window === "undefined") return;
    persisted = load();
    ready = true;
    publish();
  },
  setPanel(next: CampusSnapshot["panel"]) {
    panel = next;
    publish();
  },
  setDesk(next: Desk) {
    desk = next;
    if (next === "university") panel = "fixing";
    else if (panel === "fixing" || panel === "redeem") panel = "map";
    publish();
  },
  selectIssue(issueId: string | null, fly = false) {
    selectedIssueId = issueId;
    pendingSignalId = null;
    if (fly && issueId) {
      const issue = persisted.issues.find((item) => item.id === issueId);
      if (issue) {
        commandId += 1;
        viewCommand = { id: commandId, kind: "fly", latitude: issue.latitude, longitude: issue.longitude, zoom: 18 };
      }
    }
    publish();
  },
  dismissNotice() {
    notice = null;
    publish();
  },
  dismissSignalBanner() {
    pendingSignalId = null;
    publish();
  },
  viewPendingSignal() {
    if (!pendingSignalId) return;
    this.selectIssue(pendingSignalId, true);
  },
  requestFit() {
    commandId += 1;
    viewCommand = { id: commandId, kind: "fit" };
    publish();
  },
  requestZoom(direction: "zoom-in" | "zoom-out") {
    commandId += 1;
    viewCommand = { id: commandId, kind: direction };
    publish();
  },
  requestRotate() {
    commandId += 1;
    viewCommand = { id: commandId, kind: "rotate" };
    publish();
  },
  requestPoseReset() {
    commandId += 1;
    viewCommand = { id: commandId, kind: "reset-pose" };
    publish();
  },
  flyTo(latitude: number, longitude: number, zoom = 18) {
    commandId += 1;
    viewCommand = { id: commandId, kind: "fly", latitude, longitude, zoom };
    publish();
  },
  setPreview(level: RevealLevel | null) {
    previewLevel = level;
    notice = level === null ? "Reveal preview cleared." : `Previewing ${level === 0 ? "Quiet" : level === 1 ? "Signal" : level === 2 ? "Emerging" : level === 3 ? "Active" : "Intensive"} on the Library footprint. Reports are unchanged.`;
    publish();
  },
  openReport() {
    reportOpen = true;
    placingPin = false;
    draftLocation = null;
    publish();
  },
  closeReport() {
    reportOpen = false;
    placingPin = false;
    publish();
  },
  setPlacingPin(value: boolean) {
    placingPin = value;
    publish();
  },
  setDraftLocation(location: DraftLocation | null) {
    draftLocation = location;
    publish();
  },
  reset() {
    persisted = emptyPersisted();
    clearPreviews();
    selectedIssueId = null;
    previewLevel = null;
    pendingSignalId = null;
    draftLocation = null;
    placingPin = false;
    reportOpen = false;
    notice = "Demo reset. The map is back to the quiet campus outline.";
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
    commandId += 1;
    viewCommand = { id: commandId, kind: "fit" };
    publish();
  },
  async uploadPhoto(file: Blob, onProgress: (update: UploadProgress) => void): Promise<UploadResult> {
    await readBlobWithProgress(file, (loaded, total, indeterminate) => onProgress({ loaded, total, indeterminate }));
    const photoId = nid("photo");
    rememberPreview(photoId, file);
    persisted = {
      ...persisted,
      photos: [
        ...persisted.photos,
        { id: photoId, issueId: null, reportId: null, kind: "before", storagePath: `session/${photoId}.jpg`, createdAt: new Date().toISOString() },
      ],
    };
    save();
    publish();
    return { photoId, imagePath: `session/${photoId}.jpg`, storage: "session" };
  },
  async analyzePhoto(): Promise<AnalysisResult> {
    await wait(700);
    return {
      category: "bike_scooter_parking",
      summary: "Bikes and scooters are blocking the pedestrian route.",
      severity: "high",
      department: "Transportation and Parking Services",
      confidence: 0.86,
      accessibilityImpact: true,
      tags: ["blocked-path", "bike", "scooter"],
      provider: "mock",
    };
  },
  suggestDuplicate(input: DuplicateInput): DuplicateSuggestion | null {
    const cutoff = Date.now() - duplicateRule.maxAgeHours * 60 * 60 * 1000;
    let best: DuplicateSuggestion | null = null;
    for (const issue of persisted.issues.filter((item) => isUnresolved(item) && item.category === input.category)) {
      const latest = persisted.reports
        .filter((report) => report.issueId === issue.id)
        .map((report) => Date.parse(report.createdAt))
        .sort((a, b) => b - a)[0];
      if (!latest || latest < cutoff) continue;
      const meters = metersBetween(input.latitude, input.longitude, issue.latitude, issue.longitude);
      if (meters > duplicateRule.maxDistanceMeters) continue;
      if (!best || meters < best.distanceMeters) {
        best = {
          issueId: issue.id,
          summary: issue.summary,
          category: issue.category,
          severity: issue.severity,
          distanceMeters: Math.round(meters),
          reportCount: issue.reportCount,
          createdAt: issue.createdAt,
        };
      }
    }
    return best;
  },
  createReport(input: CreateReportInput): CreateReportResponse {
    if (!isInsideReporting(input.latitude, input.longitude)) {
      throw new Error("That pin is outside the SJSU reporting boundary.");
    }
    const now = new Date().toISOString();
    const reportId = nid("report");
    let issue: Issue;
    let duplicate = false;
    if (input.attachToIssueId) {
      const existing = persisted.issues.find((item) => item.id === input.attachToIssueId);
      if (!existing) throw new Error("The suggested signal is no longer on the map.");
      duplicate = true;
      issue = stepSeverity({ ...existing, reportCount: existing.reportCount + 1, updatedAt: now });
    } else {
      const building = input.buildingId ?? nearestLandmark(input.latitude, input.longitude)?.id ?? null;
      issue = {
        id: nid("issue"),
        campusId: input.campusId,
        regionId: input.regionId,
        buildingId: building,
        category: input.analysis.category,
        summary: input.analysis.summary,
        severity: input.analysis.severity,
        department: input.analysis.department,
        status: "open",
        latitude: input.latitude,
        longitude: input.longitude,
        accessibilityImpact: input.analysis.accessibilityImpact,
        reportCount: 1,
        tags: input.analysis.tags,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      };
    }
    const report: Report = {
      id: reportId,
      issueId: issue.id,
      reporterId: input.reporterId,
      photoId: input.photoId,
      latitude: input.latitude,
      longitude: input.longitude,
      locationSource: input.locationSource,
      locationAccuracyMeters: input.locationAccuracyMeters,
      studentDescription: input.studentDescription,
      aiConfidence: input.analysis.confidence,
      analysisProvider: input.analysis.provider,
      createdAt: now,
    };
    const event: StatusEvent = {
      id: nid("event"),
      issueId: issue.id,
      actorId: input.reporterId,
      actorRole: "student",
      fromStatus: duplicate ? issue.status : null,
      toStatus: issue.status,
      note: duplicate ? "Additional evidence added to the existing signal." : "Signal reported.",
      createdAt: now,
    };
    const photos = persisted.photos.map((photo) =>
      photo.id === input.photoId ? { ...photo, issueId: issue.id, reportId, kind: duplicate ? "evidence" as const : "before" as const } : photo,
    );
    const issues = input.attachToIssueId
      ? persisted.issues.map((item) => (item.id === issue.id ? issue : item))
      : [...persisted.issues, issue];
    const earned = credit(
      input.reporterId,
      issue.id,
      duplicate ? "confirm-report" : "first-report",
      duplicate ? 2 : 10,
      duplicate ? "Confirmed an existing signal" : "First report",
    );
    persisted = {
      issues,
      reports: [...persisted.reports, report],
      photos,
      events: [...persisted.events, event],
      credits: [...persisted.credits, earned],
    };
    pendingSignalId = issue.id;
    notice = duplicate
      ? `Evidence added. +${earned.delta} credits.${issue.escalated ? " Repeated reports moved this signal up the fixing list." : ""}`
      : `Signal submitted. +${earned.delta} credits. The map stayed where you left it.`;
    save();
    publish();
    return {
      reportId,
      issueId: issue.id,
      duplicate,
      matchedIssueId: duplicate ? issue.id : null,
      reportCount: issue.reportCount,
      region: regionState(issue.regionId),
      analysis: input.analysis,
    };
  },
  getMapState(): MapState {
    return mapState();
  },
  getIssue(issueId: string) {
    return issueDetail(issueId);
  },
  previewFor(photoId: string | null) {
    return photoId ? previewUrl(photoId) : null;
  },
  addLibrarySignal() {
    const created = ensureIssue({
      id: "issue-demo-library",
      regionId: "library",
      buildingId: "library",
      category: "bike_scooter_parking",
      summary: "Bikes and scooters are parked across the south walkway of Dr. Martin Luther King Jr. Library, leaving too little room for a wheelchair.",
      severity: "high",
      department: "Transportation and Parking Services",
      latitude: seededLibraryPin.latitude,
      longitude: seededLibraryPin.longitude,
      accessibilityImpact: true,
      tags: ["blocked-path", "bike", "scooter"],
      reporterId: "scout-1",
      note: "Library walkway reported blocked by bikes and scooters.",
    });
    notice = created
      ? "Library signal added. Detail stays around that walkway."
      : "Library signal is already on the map.";
    publish();
    save();
  },
  addIndependentEvidence() {
    if (!persisted.issues.some((issue) => issue.id === "issue-demo-library")) this.addLibrarySignal();
    const issue = persisted.issues.find((item) => item.id === "issue-demo-library");
    if (!issue) return;
    const reporters = new Set(persisted.reports.filter((report) => report.issueId === issue.id).map((report) => report.reporterId));
    const reporterId = !reporters.has("scout-2") ? "scout-2" : !reporters.has("scout-3") ? "scout-3" : null;
    if (!reporterId) {
      selectedIssueId = issue.id;
      notice = "Two independent confirmations are already on this signal.";
      publish();
      return;
    }
    const now = new Date().toISOString();
    const report: Report = {
      id: `report-demo-library-${reporterId}`,
      issueId: issue.id,
      reporterId,
      photoId: null,
      latitude: issue.latitude,
      longitude: issue.longitude,
      locationSource: "manual",
      locationAccuracyMeters: null,
      studentDescription: "Another student confirms the scooters are still blocking the library walkway.",
      aiConfidence: 0.86,
      analysisProvider: "mock",
      createdAt: now,
    };
    const updated = stepSeverity({ ...issue, reportCount: issue.reportCount + 1, updatedAt: now });
    const earned = credit(reporterId, issue.id, "confirm-report", 2, "Confirmed an existing signal");
    persisted = {
      ...persisted,
      issues: persisted.issues.map((item) => (item.id === issue.id ? updated : item)),
      reports: [...persisted.reports, report],
      credits: [...persisted.credits, earned],
      events: [
        ...persisted.events,
        {
          id: nid("event"),
          issueId: issue.id,
          actorId: reporterId,
          actorRole: "student",
          fromStatus: issue.status,
          toStatus: issue.status,
          note: `Independent evidence added. Bonus is capped at +${evidenceBonus(updated, [...persisted.reports, report])}.`,
          createdAt: now,
        },
      ],
    };
    selectedIssueId = issue.id;
    pendingSignalId = null;
    notice = updated.escalated && !issue.escalated
      ? "A third report moved this signal up the fixing list."
      : "Independent evidence added to the library signal. Repeated reports from the same demo identity would not raise the cap.";
    save();
    publish();
  },
  addNearbyIssue() {
    const libraryPoint = point([seededLibraryPin.longitude, seededLibraryPin.latitude]);
    const tower = landmarks.find((landmark) => landmark.id === "tower")!;
    const angle = bearing(libraryPoint, point([tower.longitude, tower.latitude]));
    const moved = destination(libraryPoint, 0.05, angle, { units: "kilometers" });
    const [longitude, latitude] = isInsideReporting(moved.geometry.coordinates[1], moved.geometry.coordinates[0])
      ? moved.geometry.coordinates
      : [tower.longitude, tower.latitude];
    const created = ensureIssue({
      id: "issue-demo-nearby",
      regionId: regionIdFor(latitude, longitude),
      buildingId: "tower",
      category: "lighting",
      summary: "The lamp on the walk between Tower Hall and the library is out, so the path is hard to read after dusk.",
      severity: "medium",
      department: "Facilities Electrical",
      latitude,
      longitude,
      accessibilityImpact: false,
      tags: ["lighting", "walkway"],
      reporterId: "scout-1",
      note: "Separate lighting signal near Tower Hall.",
    });
    notice = created
      ? "Nearby lighting signal added. It stays a separate pin from the library walkway."
      : "The nearby lighting signal is already on the map.";
    publish();
    save();
  },
  addUrgentIssue() {
    const engineering = landmarks.find((landmark) => landmark.id === "engineering")!;
    const created = ensureIssue({
      id: "issue-demo-urgent",
      regionId: "engineering",
      buildingId: "engineering",
      category: "water_leak",
      summary: "Water is sheeting across the north entrance of the Engineering Building, and people are stepping into the drive to get around it.",
      severity: "urgent",
      department: "Facilities Plumbing",
      latitude: engineering.latitude,
      longitude: engineering.longitude,
      accessibilityImpact: true,
      tags: ["water", "entrance", "safety"],
      reporterId: "scout-1",
      note: "Urgent engineering entrance report. Intensive local detail is immediate.",
    });
    notice = created
      ? "Urgent engineering signal added. It is visible without waiting for more reports."
      : "The urgent engineering signal is already on the map.";
    publish();
    save();
  },
  updateIssueStatus(issueId: string, status: IssueStatus, note = "") {
    const issue = persisted.issues.find((item) => item.id === issueId);
    if (!issue) throw new Error("Signal not found");
    if (!transitions[issue.status].includes(status)) {
      notice = "That update is not available for this signal.";
      publish();
      throw new Error(notice);
    }
    const now = new Date().toISOString();
    const updated: Issue = {
      ...issue,
      status,
      updatedAt: now,
      resolvedAt: status === "resolved" ? now : issue.resolvedAt,
    };
    persisted = {
      ...persisted,
      issues: persisted.issues.map((item) => (item.id === issue.id ? updated : item)),
      events: [
        ...persisted.events,
        {
          id: nid("event"),
          issueId: issue.id,
          actorId: "responder-1",
          actorRole: "university",
          fromStatus: issue.status,
          toStatus: status,
          note: note || (status === "in_progress" ? "University claimed this signal." : "University marked this signal fixed."),
          createdAt: now,
        },
      ],
    };
    notice = status === "awaiting_verification"
      ? "Marked fixed. Health returns while students confirm the repair."
      : "Signal claimed. The map stayed where it is.";
    save();
    publish();
    return issueDetail(issueId);
  },
  verifyIssue(issueId: string, input: VerificationInput) {
    const issue = persisted.issues.find((item) => item.id === issueId);
    if (!issue) throw new Error("Signal not found");
    const status: IssueStatus = input.confirmed ? "resolved" : "reopened";
    if (!transitions[issue.status].includes(status)) {
      notice = "This signal is not waiting for confirmation.";
      publish();
      throw new Error(notice);
    }
    const now = new Date().toISOString();
    const updated: Issue = {
      ...issue,
      status,
      updatedAt: now,
      resolvedAt: input.confirmed ? now : null,
    };
    const credits = [
      ...persisted.credits,
      credit(input.actorId, issue.id, input.confirmed ? "verify" : "still-unresolved", input.confirmed ? 15 : 10, input.confirmed ? "Verified a repair" : "Marked a repair incomplete"),
    ];
    if (input.confirmed) {
      const first = persisted.reports.find((report) => report.issueId === issue.id);
      if (first) credits.push(credit(first.reporterId, issue.id, "resolved", 5, "Report reached resolved"));
    }
    persisted = {
      ...persisted,
      issues: persisted.issues.map((item) => (item.id === issue.id ? updated : item)),
      credits,
      events: [
        ...persisted.events,
        {
          id: nid("event"),
          issueId: issue.id,
          actorId: input.actorId,
          actorRole: "student",
          fromStatus: issue.status,
          toStatus: status,
          note: input.confirmed ? "Student verified the repair." : "Student marked the repair incomplete.",
          createdAt: now,
        },
      ],
    };
    notice = input.confirmed ? "Repair verified. Health stays restored." : "Marked still there. Health drops until it is fixed again.";
    save();
    publish();
    return issueDetail(issueId);
  },
  redeem(actorId: string, rewardId: string) {
    const reward = rewards.find((item) => item.id === rewardId);
    if (!reward) throw new Error("That reward is not in the demo catalog.");
    if (creditBalance(persisted.credits, actorId) < reward.cost) {
      notice = "Not enough credits for that reward.";
      publish();
      throw new Error(notice);
    }
    persisted = {
      ...persisted,
      credits: [...persisted.credits, credit(actorId, null, "redeem", -reward.cost, reward.label)],
    };
    notice = `Redeemed ${reward.label}. This catalog is demo data, not a real vendor.`;
    save();
    publish();
  },
};

function ensureIssue(input: {
  id: string;
  regionId: string;
  buildingId: string;
  category: string;
  summary: string;
  severity: Issue["severity"];
  department: string;
  latitude: number;
  longitude: number;
  accessibilityImpact: boolean;
  tags: string[];
  reporterId: string;
  note: string;
}) {
  if (persisted.issues.some((issue) => issue.id === input.id)) {
    selectedIssueId = input.id;
    return false;
  }
  const now = new Date().toISOString();
  const issue: Issue = {
    id: input.id,
    campusId,
    regionId: input.regionId,
    buildingId: input.buildingId,
    category: input.category,
    summary: input.summary,
    severity: input.severity,
    department: input.department,
    status: "open",
    latitude: input.latitude,
    longitude: input.longitude,
    accessibilityImpact: input.accessibilityImpact,
    reportCount: 1,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
  const report: Report = {
    id: `${input.id}-report-1`,
    issueId: issue.id,
    reporterId: input.reporterId,
    photoId: null,
    latitude: input.latitude,
    longitude: input.longitude,
    locationSource: "manual",
    locationAccuracyMeters: null,
    studentDescription: input.summary,
    aiConfidence: 0.9,
    analysisProvider: "mock",
    createdAt: now,
  };
  const event: StatusEvent = {
    id: `${input.id}-event-1`,
    issueId: issue.id,
    actorId: input.reporterId,
    actorRole: "student",
    fromStatus: null,
    toStatus: "open",
    note: input.note,
    createdAt: now,
  };
  persisted = {
    issues: [...persisted.issues, issue],
    reports: [...persisted.reports, report],
    photos: persisted.photos,
    events: [...persisted.events, event],
    credits: [...persisted.credits, credit(input.reporterId, issue.id, "first-report", 10, "First report")],
  };
  selectedIssueId = issue.id;
  return true;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
