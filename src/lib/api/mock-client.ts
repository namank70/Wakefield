import { campusStore } from "@/lib/state/store";
import type { WakefieldClient } from "@/lib/types";

export const mockClient: WakefieldClient = {
  uploadPhoto: (file, onProgress) => campusStore.uploadPhoto(file, onProgress),
  analyzePhoto: () => campusStore.analyzePhoto(),
  suggestDuplicate: async (input) => campusStore.suggestDuplicate(input),
  createReport: async (input) => campusStore.createReport(input),
  getMapState: async () => campusStore.getMapState(),
  getIssue: async (issueId) => campusStore.getIssue(issueId),
  updateIssueStatus: async (issueId, status, note) => campusStore.updateIssueStatus(issueId, status, note),
  verifyIssue: async (issueId, input) => campusStore.verifyIssue(issueId, input),
};
