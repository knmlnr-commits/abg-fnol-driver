"use client";
import type { EvidenceSlot } from "@/lib/domain/constants";
import { api, ApiError, type CompletenessView } from "./api";

/**
 * Upload queue for photos and documents.
 * - Images are compressed on the phone before upload.
 * - Each file waits in IndexedDB until the server confirmed it, so a lost connection or a
 *   closed tab does not lose a photo. It is deleted from the phone right after upload.
 * - Failed uploads retry with backoff and again when the phone is back online.
 */

export type QueueItem = {
  id: string;
  incidentKey: string;
  slot: EvidenceSlot;
  blob: Blob;
  mime: string;
  capturedAt: string;
  lat?: number;
  lng?: number;
};
export type ItemState = { id: string; slot: EvidenceSlot; status: "queued" | "uploading" | "failed"; preview: string };

const DB = "fnol-uploads";
const STORE = "queue";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined; // private mode or no IndexedDB: the queue still works in memory
  }
}

export const queueStore = {
  put: (item: QueueItem) => withStore("readwrite", (s) => s.put(item)),
  remove: (id: string) => withStore("readwrite", (s) => s.delete(id)),
  async list(incidentKey: string): Promise<QueueItem[]> {
    const all = ((await withStore("readonly", (s) => s.getAll())) ?? []) as QueueItem[];
    return all.filter((i) => i.incidentKey === incidentKey);
  },
};

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.82;

/** Resize to at most 2048 px on the long edge and re-encode as JPEG. Removes EXIF data as a side effect. */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", JPEG_QUALITY));
}

export async function prepareFile(file: File): Promise<{ blob: Blob; mime: string }> {
  if (file.type === "application/pdf") return { blob: file, mime: file.type };
  if (!file.type.startsWith("image/")) throw new ApiError(422, "invalid_type");
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
    const blob = await Promise.race([compress(file), timeout]);
    // Keep the original if it was already smaller (for example a small PNG screenshot).
    return blob.size < file.size || file.type === "image/heic" ? { blob, mime: "image/jpeg" } : { blob: file, mime: file.type };
  } catch {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ApiError(422, "invalid_type");
    return { blob: file, mime: file.type };
  }
}

export function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

/** Uploads one queued item: signed URL, PUT, confirm. Throws on failure. */
export async function uploadItem(token: string, item: QueueItem, source: "driver" | "station" = "driver") {
  const { path, url } = await api<{ path: string; url: string }>(token, "/api/incident/upload", {
    method: "POST",
    body: { slot: item.slot, mime: item.mime, size: item.blob.size },
  });
  const put = await fetch(url, { method: "PUT", headers: { "content-type": item.mime, "x-upsert": "false" }, body: item.blob });
  if (!put.ok) throw new ApiError(put.status, put.status === 413 ? "too_large" : "network");
  return api<{ id: string; completeness: CompletenessView }>(token, "/api/incident/evidence", {
    method: "POST",
    body: { path, slot: item.slot, mime: item.mime, capturedAt: item.capturedAt, lat: item.lat, lng: item.lng, source },
  });
}
