import { campusStore } from "@/lib/state/store";
import type { WakefieldClient } from "@/lib/types";
import { photoBlob } from "@/lib/api/images";
import { analyzePhotoImage } from "@/lib/api/vision";

export const mockClient: WakefieldClient = {
  uploadPhoto: (file, onProgress) => campusStore.uploadPhoto(file, onProgress),
  analyzePhoto: async (input) => {
    const image = photoBlob(input.photoId);
    if (!image) throw new Error("Choose the photo again so local AI can inspect it.");
    return analyzePhotoImage(image, input);
  },
  suggestDuplicate: async (input) => campusStore.suggestDuplicate(input),
  createReport: async (input) => campusStore.createReport(input),
  getMapState: async () => campusStore.getMapState(),
  getIssue: async (issueId) => campusStore.getIssue(issueId),
  updateIssueStatus: async (issueId, status, note) => campusStore.updateIssueStatus(issueId, status, note),
  verifyIssue: async (issueId, input) => campusStore.verifyIssue(issueId, input),
};
