"use client";
import type { Draft } from "@/lib/domain/schema";
import type { EvidenceRequirement } from "@/lib/domain/evidence";
import type { EvidenceSlot } from "@/lib/domain/constants";

export type MissingItem = { key: string; level: "required" | "recommended"; step: string };
export type CompletenessView = { score: number; missing: MissingItem[] };
export type EvidenceView = { id: string; slot: EvidenceSlot; mime: string; url: string | null; createdAt: string };
export type IncidentView = {
  mode: "incident" | "docreq";
  reference: string;
  status: "draft" | "submitted";
  step: string | null;
  submittedAt: string | null;
  draft: Draft;
  context: { stationName: string | null; city: string | null; country: string | null; emergency: string; lat: number | null; lng: number | null };
  evidence: EvidenceView[];
  requirements: EvidenceRequirement[];
  completeness: CompletenessView;
  request: { id: string; slots: EvidenceSlot[]; message: string | null } | null;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** JSON call with the personal link token. Network errors are retried a few times. */
export async function api<T>(token: string, path: string, init: { method?: string; body?: unknown } = {}, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(path, {
        method: init.method ?? "GET",
        headers: { authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "server_error");
      return data as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? new ApiError(0, "network") : new ApiError(0, "network");
}

export function track(token: string, event: "step_viewed" | "step_completed" | "flow_resumed", step?: string) {
  fetch("/api/incident/events", {
    method: "POST",
    keepalive: true,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ event, step }),
  }).catch(() => undefined);
}

export function errorKey(e: unknown): string {
  return e instanceof ApiError ? e.code : "server_error";
}
