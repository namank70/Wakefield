export type Severity = "low" | "medium" | "high" | "urgent";

export type IssueStatus =
  | "open"
  | "in_progress"
  | "awaiting_verification"
  | "resolved"
  | "reopened";

export type LocationSource = "device" | "manual";

export type AnalysisProvider = "eaiser" | "cached" | "mock";

export type RevealLevel = 0 | 1 | 2 | 3 | 4;

export type PhotoKind = "before" | "evidence" | "after";

export type AnalysisResult = {
  category: string;
  summary: string;
  severity: Severity;
  department: string;
  confidence: number;
  accessibilityImpact: boolean;
  tags: string[];
  provider: AnalysisProvider;
};

export type RegionState = {
  id: string;
  name: string;
  activationScore: number;
  activationThreshold: number;
  active: boolean;
};

export type CreateReportResponse = {
  reportId: string;
  issueId: string;
  duplicate: boolean;
  matchedIssueId: string | null;
  reportCount: number;
  region: RegionState;
  analysis: AnalysisResult;
};

export type Issue = {
  id: string;
  campusId: string;
  regionId: string;
  buildingId: string | null;
  category: string;
  summary: string;
  severity: Severity;
  department: string;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  accessibilityImpact: boolean;
  reportCount: number;
  tags: string[];
  escalated?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type Report = {
  id: string;
  issueId: string;
  reporterId: string;
  photoId: string | null;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  locationAccuracyMeters: number | null;
  studentDescription: string;
  aiConfidence: number;
  analysisProvider: AnalysisProvider;
  createdAt: string;
};

export type PhotoEvidence = {
  id: string;
  issueId: string | null;
  reportId: string | null;
  kind: PhotoKind;
  storagePath: string;
  createdAt: string;
};

export type StatusEvent = {
  id: string;
  issueId: string;
  actorId: string;
  actorRole: string;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus;
  note: string;
  createdAt: string;
};

export type MapState = {
  campusId: string;
  regions: RegionState[];
  issues: Issue[];
  reports: Report[];
  photos: PhotoEvidence[];
  events: StatusEvent[];
};

export type IssueDetail = Issue & {
  reports: Report[];
  photos: PhotoEvidence[];
  events: StatusEvent[];
  independentReporterCount: number;
  region: RegionState;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  indeterminate: boolean;
};

export type UploadResult = {
  photoId: string;
  imagePath: string;
  storage: "session" | "remote";
};

export type AnalyzePhotoInput = {
  photoId: string;
  latitude?: number;
  longitude?: number;
  campusId: string;
  regionId?: string;
  buildingId?: string;
};

export type DuplicateInput = {
  category: string;
  latitude: number;
  longitude: number;
  campusId: string;
};

export type DuplicateSuggestion = {
  issueId: string;
  summary: string;
  category: string;
  severity: Severity;
  distanceMeters: number;
  reportCount: number;
  createdAt: string;
};

export type CreateReportInput = {
  campusId: string;
  regionId: string;
  buildingId: string | null;
  photoId: string | null;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  locationAccuracyMeters: number | null;
  studentDescription: string;
  analysis: AnalysisResult;
  reporterId: string;
  attachToIssueId: string | null;
};

export type CreditReason = "first-report" | "confirm-report" | "resolved" | "verify" | "still-unresolved" | "redeem";

export type CreditEvent = {
  id: string;
  actorId: string;
  issueId: string | null;
  reason: CreditReason;
  delta: number;
  label: string;
  createdAt: string;
};

export type VerificationInput = {
  confirmed: boolean;
  actorId: string;
};

export type WakefieldClient = {
  uploadPhoto(file: Blob, onProgress: (update: UploadProgress) => void): Promise<UploadResult>;
  analyzePhoto(input: AnalyzePhotoInput): Promise<AnalysisResult>;
  suggestDuplicate(input: DuplicateInput): Promise<DuplicateSuggestion | null>;
  createReport(input: CreateReportInput): Promise<CreateReportResponse>;
  getMapState(): Promise<MapState>;
  getIssue(issueId: string): Promise<IssueDetail>;
  updateIssueStatus(issueId: string, status: IssueStatus, note?: string): Promise<IssueDetail>;
  verifyIssue(issueId: string, input: VerificationInput): Promise<IssueDetail>;
};
