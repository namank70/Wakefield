import { getClient } from "@/lib/api";
import { compressImage } from "@/lib/api/images";
import { dataMode } from "@/lib/config/env";
import type { CampusTestPhoto } from "@/lib/demo/scenarios";
import { campusStore } from "@/lib/state/store";

export type SequenceProgress = { completed: number; total: number; title: string; saved: number; skipped: number };

export async function analyzePhotoSequence(photos: CampusTestPhoto[], update: (progress: SequenceProgress) => void, stopped: () => boolean) {
  const client = getClient();
  let saved = 0, skipped = 0, completed = 0;
  campusStore.selectIssue(null);
  campusStore.setPanel("map");
  campusStore.requestFit();
  for (const photo of photos) {
    if (stopped()) break;
    update({ completed, total: photos.length, title: photo.title, saved, skipped });
    if (campusStore.getSnapshot().photos.some((item) => item.issueId && item.storagePath === photo.image)) {
      skipped++; completed++;
      update({ completed, total: photos.length, title: photo.title, saved, skipped });
      continue;
    }
    let photoId: string | null = null;
    try {
      const response = await fetch(photo.image);
      if (!response.ok) throw new Error(`Could not load ${photo.title}.`);
      const image = await compressImage(await response.blob());
      const uploaded = await client.uploadPhoto(image, () => {});
      photoId = uploaded.photoId;
      const analysis = await client.analyzePhoto({ photoId, campusId: "sjsu", latitude: photo.latitude, longitude: photo.longitude });
      if (analysis.provider !== "ollama" && analysis.provider !== "eaiser") throw new Error("Choose a connected photo AI provider to analyze this set.");
      if (analysis.issueDetected === false) {
        skipped++;
        if (dataMode === "mock") campusStore.discardPhoto(photoId);
      } else {
        const duplicate = await client.suggestDuplicate({ category: analysis.category, latitude: photo.latitude, longitude: photo.longitude, campusId: "sjsu" });
        await client.createReport({ campusId: "sjsu", regionId: photo.regionId, buildingId: photo.buildingId, photoId, latitude: photo.latitude, longitude: photo.longitude, locationSource: "manual", locationAccuracyMeters: null, studentDescription: analysis.summary, analysis, reporterId: "scout-1", attachToIssueId: duplicate?.issueId ?? null });
        if (dataMode === "mock") campusStore.linkTestPhoto(photoId, photo.image);
        else campusStore.replaceFromMapState(await client.getMapState());
        saved++;
      }
      completed++;
      update({ completed, total: photos.length, title: photo.title, saved, skipped });
    } catch (error) {
      if (dataMode === "mock" && photoId) campusStore.discardPhoto(photoId);
      throw error;
    }
  }
  campusStore.dismissSignalBanner();
  return { completed, total: photos.length, title: "Complete", saved, skipped };
}
