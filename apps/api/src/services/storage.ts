import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";
import type { StorageProvider } from "./types";

function safeKey(key: string): string {
  const k = path.posix.normalize(key.replace(/\\/g, "/")).replace(/^\/+/, "");
  if (k.startsWith("..") || k.includes("/../")) throw new Error("مفتاح تخزين غير صالح");
  return k;
}

export class LocalStorage implements StorageProvider {
  readonly name = "local";
  constructor(private root: string) {}
  private p(key: string) { return path.join(path.resolve(this.root), safeKey(key)); }
  async put(key: string, data: Buffer): Promise<void> { const f = this.p(key); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, data); }
  async get(key: string) { try { return { data: await readFile(this.p(key)) }; } catch { return null; } }
  async delete(key: string): Promise<void> { await rm(this.p(key), { force: true }); }
}

/** تخزين متوافق مع S3 (AWS / MinIO / Cloudflare R2 / Supabase Storage S3) */
export class S3Storage implements StorageProvider {
  readonly name = "s3";
  private client: any; private cmds: any;
  constructor(private cfg: Config) {}
  private async init() {
    if (this.client) return;
    const m = await import("@aws-sdk/client-s3");
    this.cmds = m;
    this.client = new m.S3Client({
      region: this.cfg.S3_REGION, endpoint: this.cfg.S3_ENDPOINT || undefined, forcePathStyle: this.cfg.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: this.cfg.S3_ACCESS_KEY, secretAccessKey: this.cfg.S3_SECRET_KEY },
    });
  }
  async put(key: string, data: Buffer, contentType?: string) {
    await this.init();
    await this.client.send(new this.cmds.PutObjectCommand({ Bucket: this.cfg.S3_BUCKET, Key: safeKey(key), Body: data, ContentType: contentType }));
  }
  async get(key: string) {
    await this.init();
    try {
      const r = await this.client.send(new this.cmds.GetObjectCommand({ Bucket: this.cfg.S3_BUCKET, Key: safeKey(key) }));
      return { data: Buffer.from(await r.Body.transformToByteArray()), contentType: r.ContentType as string | undefined };
    } catch { return null; }
  }
  async delete(key: string) { await this.init(); await this.client.send(new this.cmds.DeleteObjectCommand({ Bucket: this.cfg.S3_BUCKET, Key: safeKey(key) })); }
}
export const createStorage = (cfg: Config): StorageProvider => (cfg.STORAGE_PROVIDER === "s3" ? new S3Storage(cfg) : new LocalStorage(cfg.STORAGE_DIR));
