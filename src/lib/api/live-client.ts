import { apiBaseUrl } from "@/lib/config/env";
import type {
  AnalysisResult,
  CreateReportInput,
  CreateReportResponse,
  DuplicateInput,
  DuplicateSuggestion,
  IssueDetail,
  IssueStatus,
  MapState,
  UploadProgress,
  UploadResult,
  VerificationInput,
  WakefieldClient,
} from "@/lib/types";
import { rememberPreview } from "@/lib/api/images";

/**
 * Live adapter. Components never call these endpoints directly.
 *
 * NEXT_PUBLIC_DATA_MODE=live
 * NEXT_PUBLIC_API_BASE_URL=https://host
 *
 * POST /api/uploads
 *   JSON { contentType, campusId } -> { photoId, imagePath, uploadUrl? }
 *   When uploadUrl is present, PUT the compressed image there.
 *   Otherwise POST multipart field "image" to /api/uploads.
 *
 * POST /api/analyze
 *   multipart: image, latitude, longitude, campusId, regionId, buildingId
 *   -> AnalysisResult
 *
 * POST /api/duplicates/suggest
 *   JSON DuplicateInput -> DuplicateSuggestion | null
 *   Not in the backend brief yet. Confirm this path with the integration owner.
 *
 * POST /api/reports
 *   JSON CreateReportInput, with imagePath instead of a local photo id
 *   -> CreateReportResponse
 *
 * GET /api/map-state?campusId=sjsu -> MapState
 * GET /api/issues/:issueId -> IssueDetail
 * PATCH /api/issues/:issueId/status  JSON { status, note }
 * POST /api/issues/:issueId/verify   JSON VerificationInput
 */

function base() {
  return apiBaseUrl.replace(/\/$/, "");
}

async function readError(response: Response) {
  const text = await response.text();
  throw new Error(text || `Request failed (${response.status})`);
}

function putWithProgress(url: string, file: Blob, onProgress: (update: UploadProgress) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "image/jpeg");
    request.upload.onprogress = (event) => {
      onProgress({
        loaded: event.loaded,
        total: event.total,
        indeterminate: !event.lengthComputable,
      });
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Upload failed (${request.status})`));
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(file);
  });
}

export const liveClient: WakefieldClient = {
  async uploadPhoto(file, onProgress) {
    const body = new FormData();
    body.set("campusId", "sjsu");
    body.set("image", file, "campus-report.jpg");
    const response = await fetch(`${base()}/api/uploads`, { method: "POST", body });
    if (!response.ok) await readError(response);
    const payload = (await response.json()) as { photoId: string; imagePath: string; uploadUrl?: string };
    rememberPreview(payload.photoId, file);
    if (payload.uploadUrl) await putWithProgress(payload.uploadUrl, file, onProgress);
    else onProgress({ loaded: file.size, total: file.size, indeterminate: false });
    const result: UploadResult = { photoId: payload.photoId, imagePath: payload.imagePath, storage: "remote" };
    return result;
  },
  async analyzePhoto(input) {
    const body = new FormData();
    body.set("photoId", input.photoId);
    body.set("campusId", input.campusId);
    if (input.latitude !== undefined) body.set("latitude", String(input.latitude));
    if (input.longitude !== undefined) body.set("longitude", String(input.longitude));
    if (input.regionId) body.set("regionId", input.regionId);
    if (input.buildingId) body.set("buildingId", input.buildingId);
    const response = await fetch(`${base()}/api/analyze`, { method: "POST", body });
    if (!response.ok) await readError(response);
    return (await response.json()) as AnalysisResult;
  },
  async suggestDuplicate(input: DuplicateInput) {
    const response = await fetch(`${base()}/api/duplicates/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (response.status === 204) return null;
    if (!response.ok) await readError(response);
    const payload = (await response.json()) as DuplicateSuggestion | null;
    return payload;
  },
  async createReport(input: CreateReportInput) {
    const response = await fetch(`${base()}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) await readError(response);
    return (await response.json()) as CreateReportResponse;
  },
  async getMapState() {
    const response = await fetch(`${base()}/api/map-state?campusId=sjsu`);
    if (!response.ok) await readError(response);
    return (await response.json()) as MapState;
  },
  async getIssue(issueId) {
    const response = await fetch(`${base()}/api/issues/${encodeURIComponent(issueId)}`);
    if (!response.ok) await readError(response);
    return (await response.json()) as IssueDetail;
  },
  async updateIssueStatus(issueId: string, status: IssueStatus, note?: string) {
    const response = await fetch(`${base()}/api/issues/${encodeURIComponent(issueId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    if (!response.ok) await readError(response);
    return (await response.json()) as IssueDetail;
  },
  async verifyIssue(issueId: string, input: VerificationInput) {
    const response = await fetch(`${base()}/api/issues/${encodeURIComponent(issueId)}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) await readError(response);
    return (await response.json()) as IssueDetail;
  },
};
