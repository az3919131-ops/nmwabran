// يشغّل مكدّس الاختبار كاملًا بلا docker: قاعدة بيانات نظيفة + خادم SMTP وهمي (مثل MailHog) + الخادم والواجهة المبنية.
// الاستخدام (يستدعيه playwright.config.ts تلقائيًا):  node e2e/start-stack.mjs
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { startSmtpSink } from "./smtp-sink.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.E2E_PORT || "3100", SMTP = +(process.env.E2E_SMTP_PORT || 2526), MAIL_API = +(process.env.E2E_MAIL_API_PORT || 3199);
const ADMIN_URL = process.env.E2E_DB_ADMIN_URL || "postgresql://iltizam:iltizam@127.0.0.1:5432/postgres";
const DB = "iltizam_e2e";

// 1) قاعدة بيانات نظيفة
const c = new pg.Client({ connectionString: ADMIN_URL }); await c.connect();
await c.query(`drop database if exists ${DB} with (force)`); await c.query(`create database ${DB}`); await c.end();

// 2) الواجهة المبنية
const dist = path.join(root, "apps/web/dist");
if (!existsSync(path.join(dist, "index.html")) || process.env.E2E_REBUILD) {
  const r = spawnSync("npm", ["run", "build", "-w", "@iltizam/web"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 3) خادم SMTP وهمي + واجهة JSON لقراءة الرسائل
const sink = await startSmtpSink(SMTP);
const api = http.createServer((req, res) => {
  if (req.url === "/messages") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(sink.messages.map((m) => ({ to: m.to, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments.map((a) => ({ filename: a.filename, size: a.size, contentType: a.contentType })) }))));
  } else if (req.url === "/clear" && req.method === "POST") { sink.clear(); res.writeHead(204).end(); }
  else res.writeHead(404).end();
});
await new Promise((r) => api.listen(MAIL_API, "127.0.0.1", r));

// 4) الخادم (يخدم الواجهة المبنية أيضًا، ويطبع PDF من نفسه)
const env = {
  ...process.env, NODE_ENV: "development", PORT, HOST: "127.0.0.1", DATABASE_URL: ADMIN_URL.replace(/\/[^/]+$/, "/" + DB),
  JWT_SECRET: "e2e-secret-123456", WEBHOOK_SECRET: "e2e-hook-123456", WEB_DIST_DIR: dist, PDF_RENDER_BASE_URL: `http://127.0.0.1:${PORT}`,
  STORAGE_DIR: mkdtempSync(path.join(os.tmpdir(), "iltizam-e2e-")), SMTP_HOST: "127.0.0.1", SMTP_PORT: String(SMTP), MAIL_PROVIDER: "smtp",
  ADMIN_EMAIL: "az3919131@gmail.com", SEED_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || "Admin@12345", SEED_DEPT_PASSWORD: "Dept@12345", SEED_PM_PASSWORD: "Pm@12345",
  SEED_DEMO_DATA: "true", CHROMIUM_PATH: process.env.E2E_CHROMIUM || process.env.CHROMIUM_PATH || "",
};
const srv = spawn("node", ["--import", "tsx", "src/server.ts"], { cwd: path.join(root, "apps/api"), env, stdio: ["ignore", "inherit", "inherit"] });
const stop = async () => { srv.kill("SIGTERM"); await sink.close().catch(() => {}); api.close(); process.exit(0); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);
srv.on("exit", (code) => process.exit(code ?? 1));
