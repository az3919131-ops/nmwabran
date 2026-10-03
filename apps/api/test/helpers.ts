import type { FastifyInstance } from "fastify";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { loadConfig, type Config } from "../src/config";
import { buildApp } from "../src/app";
import { buildContext } from "../src/context";
import { createDb, type DbHandle } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { seedAll } from "../src/db/seed";
import { allRoutes } from "../src/routes";
import { LocalStorage } from "../src/services/storage";
import type { InlineQueue } from "../src/services/queue";
import type { MailMessage, MailProvider, SendResult } from "../src/services/types";
import type { AppCtx } from "../src/app";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const ADMIN_URL = process.env.TEST_DB_ADMIN_URL ?? "postgresql://iltizam:iltizam@127.0.0.1:5432/postgres";

/** مزوّد بريد وهمي يجمع الرسائل ويسمح بحقن إخفاقات لمستلمين */
export class FakeMail implements MailProvider {
  name = "fake";
  sent: MailMessage[] = [];
  failFor = new Set<string>();
  healthy = true;
  async send(msg: MailMessage): Promise<SendResult> {
    if (msg.to.some((t) => this.failFor.has(t.toLowerCase()))) return { ok: false, error: "550 mailbox unavailable" };
    this.sent.push(msg);
    return { ok: true, messageId: "fake-" + this.sent.length };
  }
  async health() { return { ok: this.healthy, provider: "fake", detail: this.healthy ? "ok" : "down" }; }
  to(email: string) { return this.sent.filter((m) => m.to.map((x) => x.toLowerCase()).includes(email.toLowerCase())); }
}

export interface TestEnv {
  app: FastifyInstance; ctx: AppCtx; h: DbHandle; cfg: Config; mail: FakeMail; dbName: string; idle: () => Promise<void>;
  inject: (method: string, url: string, o?: { token?: string; body?: unknown; headers?: Record<string, string>; cookies?: Record<string, string> }) => Promise<{ status: number; json: any; headers: Record<string, any>; raw: string; cookies: any[] }>;
  login: (user?: string, pass?: string) => Promise<{ token: string; cookie: string }>;
  unlockedToken: (user?: string, pass?: string) => Promise<string>;
  close: () => Promise<void>;
}

export async function createTestEnv(over: Partial<NodeJS.ProcessEnv> = {}): Promise<TestEnv> {
  const dbName = "iltizam_t_" + randomBytes(4).toString("hex");
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect(); await admin.query(`create database ${dbName}`); await admin.end();
  const url = ADMIN_URL.replace(/\/[^/]+$/, "/" + dbName);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "iltizam-"));
  const cfg = loadConfig({ NODE_ENV: "test", DATABASE_URL: url, JWT_SECRET: "test-secret-123456", WEBHOOK_SECRET: "wh-test", ADMIN_EMAIL: "az3919131@gmail.com", STORAGE_DIR: tmp, DISABLE_PDF: "true", QUEUE_ENABLED: "false", SMTP_HOST: "", ...over } as NodeJS.ProcessEnv);
  const h = createDb(url);
  await runMigrations(h.db);
  await seedAll(h.db, cfg, { info() {}, warn() {} });
  const mail = new FakeMail();
  const ctx = await buildContext(cfg, h, { mail, storage: new LocalStorage(tmp), pdf: null, queue: "inline" });
  const app = await buildApp({ ctx, routes: allRoutes });
  await app.ready();
  const inject: TestEnv["inject"] = async (method, url2, o = {}) => {
    const res = await app.inject({ method: method as any, url: url2, headers: { ...(o.token ? { authorization: "Bearer " + o.token } : {}), ...(o.headers ?? {}) }, payload: o.body as any, cookies: o.cookies });
    let json: any = null; try { json = JSON.parse(res.body); } catch { /* غير JSON */ }
    return { status: res.statusCode, json, headers: res.headers, raw: res.body, cookies: res.cookies as any[] };
  };
  const login: TestEnv["login"] = async (user = "ahmed", pass = "Admin@12345") => {
    const r = await inject("POST", "/api/v1/auth/login", { body: { username: user, password: pass } });
    if (r.status !== 200) throw new Error("login failed " + r.status + " " + r.raw);
    return { token: r.json.accessToken, cookie: r.cookies.find((c) => c.name === "iltizam_rt")?.value };
  };
  const unlockedToken: TestEnv["unlockedToken"] = async (user = "ahmed", pass = "Admin@12345") => {
    const { token } = await login(user, pass);
    const u = await inject("POST", "/api/v1/auth/unlock", { token, body: { password: "Admin@12345" } });
    if (u.status !== 200) throw new Error("unlock failed " + u.raw);
    return token;
  };
  return {
    app, ctx, h, cfg, mail, dbName, inject, login, unlockedToken,
    idle: async () => { await (ctx.queue as InlineQueue).idle(); },
    close: async () => {
      await app.close(); await (ctx.queue as InlineQueue).stop(); await h.close();
      const a = new pg.Client({ connectionString: ADMIN_URL }); await a.connect();
      await a.query(`drop database if exists ${dbName} with (force)`); await a.end();
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}

/** يبني جسم multipart/form-data يدويًا لاستخدامه مع app.inject */
export function multipart(files: { name: string; data: Buffer; type?: string; field?: string }[], fields: Record<string, string> = {}) {
  const b = "----iltizam" + randomBytes(8).toString("hex");
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const f of files) {
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${f.field ?? "file"}"; filename="${f.name}"\r\nContent-Type: ${f.type ?? "application/octet-stream"}\r\n\r\n`), f.data, Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${b}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { "content-type": `multipart/form-data; boundary=${b}` } };
}
