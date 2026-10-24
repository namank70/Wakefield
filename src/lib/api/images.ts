const previews = new Map<string, string>();
const blobs = new Map<string, Blob>();

export function rememberPreview(photoId: string, file: Blob) {
  const existing = previews.get(photoId);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(file);
  previews.set(photoId, url);
  blobs.set(photoId, file);
  return url;
}

export function photoBlob(photoId: string) {
  return blobs.get(photoId) ?? null;
}

export function forgetPhoto(photoId: string) {
  const url = previews.get(photoId);
  if (url) URL.revokeObjectURL(url);
  previews.delete(photoId);
  blobs.delete(photoId);
}

export function previewUrl(photoId: string) {
  return previews.get(photoId) ?? null;
}

export function clearPreviews() {
  for (const url of previews.values()) URL.revokeObjectURL(url);
  previews.clear();
  blobs.clear();
}

export function readBlobWithProgress(file: Blob, onProgress: (loaded: number, total: number, indeterminate: boolean) => void) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total, false);
      else onProgress(0, 0, true);
    };
    reader.onload = () => {
      onProgress(file.size, file.size, false);
      resolve();
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image"));
    reader.readAsArrayBuffer(file);
  });
}

export async function compressImage(file: Blob, maxEdge = 768) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not compress the image");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not compress the image"))), "image/jpeg", 0.72);
  });
  return blob;
}
