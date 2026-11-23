import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Object storage behind one small interface: Supabase Storage in the cloud, a folder locally. */
export interface EvidenceStorage {
  /** A URL the browser can PUT the file to, valid for a short time, for this exact path only. */
  createUploadUrl(objectPath: string): Promise<string>;
  /** Size in bytes, or null if the object does not exist. */
  size(objectPath: string): Promise<number | null>;
  createReadUrl(objectPath: string, seconds: number): Promise<string>;
  remove(paths: string[]): Promise<void>;
}

const BUCKET = "evidence";

class SupabaseStorage implements EvidenceStorage {
  private client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async createUploadUrl(p: string) {
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUploadUrl(p);
    if (error || !data) throw new Error(`storage: ${error?.message}`);
    return data.signedUrl;
  }
  async size(p: string) {
    const { data, error } = await this.client.storage.from(BUCKET).info(p);
    if (error || !data) return null;
    return typeof data.size === "number" ? data.size : null;
  }
  async createReadUrl(p: string, seconds: number) {
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUrl(p, seconds);
    if (error || !data) throw new Error(`storage: ${error?.message}`);
    return data.signedUrl;
  }
  async remove(paths: string[]) {
    if (paths.length) await this.client.storage.from(BUCKET).remove(paths);
  }
}

/** Development only. Files go to .local-storage; URLs are HMAC signed like the real thing. */
class LocalStorage implements EvidenceStorage {
  private dir = path.resolve(process.cwd(), ".local-storage");
  private secret = process.env.TOKEN_KEYS ?? "local";
  sign(p: string, exp: number, op: "put" | "get") {
    return createHmac("sha256", this.secret).update(`${op}:${p}:${exp}`).digest("hex");
  }
  verify(p: string, exp: number, op: "put" | "get", sig: string) {
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const a = Buffer.from(this.sign(p, exp, op));
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  file(p: string) {
    const f = path.resolve(this.dir, p);
    if (!f.startsWith(this.dir + path.sep)) throw new Error("bad path");
    return f;
  }
  url(p: string, seconds: number, op: "put" | "get") {
    const exp = Date.now() + seconds * 1000;
    return `/api/dev-storage?op=${op}&path=${encodeURIComponent(p)}&exp=${exp}&sig=${this.sign(p, exp, op)}`;
  }
  async createUploadUrl(p: string) {
    return this.url(p, 7200, "put");
  }
  async size(p: string) {
    try {
      return (await stat(this.file(p))).size;
    } catch {
      return null;
    }
  }
  async createReadUrl(p: string, seconds: number) {
    return this.url(p, seconds, "get");
  }
  async remove(paths: string[]) {
    await Promise.all(paths.map((p) => unlink(this.file(p)).catch(() => undefined)));
  }
  async put(p: string, body: Buffer) {
    const f = this.file(p);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body, { flag: "wx" });
  }
  async get(p: string) {
    return readFile(this.file(p));
  }
}

let instance: EvidenceStorage | null = null;
export function storage(): EvidenceStorage {
  if (!instance) {
    if (process.env.STORAGE_DRIVER === "local") {
      if (process.env.VERCEL) throw new Error("Local storage is not allowed on Vercel");
      instance = new LocalStorage();
    } else {
      instance = new SupabaseStorage();
    }
  }
  return instance;
}

export function localStorageDriver(): LocalStorage | null {
  const s = storage();
  return s instanceof LocalStorage ? s : null;
}
