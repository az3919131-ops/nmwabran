import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Config } from "./config";
import type { DbHandle } from "./db/client";
import { HttpError } from "./lib/errors";
import { registerAuth } from "./plugins/auth";
import type { AiService } from "./services/ai";
import type { PdfRenderer } from "./services/reports/pdf";
import type { AppEvents, JobQueue, MailProvider, StorageProvider } from "./services/types";

export interface AppCtx {
  cfg: Config; h: DbHandle; db: DbHandle["db"];
  mail: MailProvider; storage: StorageProvider; queue: JobQueue; events: AppEvents; ai: AiService; pdf: PdfRenderer | null;
}
declare module "fastify" { interface FastifyInstance { ctx: AppCtx } }

export interface BuildOpts { ctx: AppCtx; logger?: boolean; routes?: ((app: FastifyInstance) => Promise<void> | void)[] }

export async function buildApp(opts: BuildOpts): Promise<FastifyInstance> {
  const { ctx } = opts;
  const app = Fastify({ logger: opts.logger ? { level: "info", redact: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-api-key']"] } : false, trustProxy: true, bodyLimit: 20 * 1024 * 1024, routerOptions: { maxParamLength: 2048 } });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("ctx", ctx);

  await app.register(cors, { origin: ctx.cfg.CORS_ORIGINS ? ctx.cfg.CORS_ORIGINS.split(",").map((s) => s.trim()) : [ctx.cfg.APP_BASE_URL], credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 600, timeWindow: "1 minute", hook: "preHandler" });
  await app.register(multipart, { limits: { fileSize: 60 * 1024 * 1024, files: 20 } });
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "محفظة الالتزام — Compliance Vault API", version: "1.0.0", description: "REST API تحت /api/v1. المصادقة: Bearer JWT (المستخدمون) أو X-API-Key (الأنظمة الخارجية).\n\nProject manager · Eng. Ahmed Zahran" },
      servers: [{ url: "/" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }, apiKey: { type: "apiKey", in: "header", name: "X-API-Key" } } },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs" });
  registerAuth(app);

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code ?? "error", message: err.message, ...(err.extra ?? {}) } });
    if (err.validation || err.code === "FST_ERR_VALIDATION" || err.name === "ZodError") {
      const issues = (err.validation ?? err.issues ?? []).slice?.(0, 5) ?? [];
      return reply.code(400).send({ error: { code: "validation", message: "بيانات غير صالحة", details: issues.map((i: any) => i.message ?? String(i)) } });
    }
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: "rate_limited", message: "محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة" } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: err.code ?? "error", message: err.message } });
    req.log.error({ err }, "unhandled");
    return reply.code(500).send({ error: { code: "internal", message: "حدث خطأ داخلي" } });
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.code(404).send({ error: { code: "not_found", message: "المسار غير موجود" } });
    // SPA fallback
    const dist = ctx.cfg.WEB_DIST_DIR;
    if (dist && existsSync(path.join(dist, "index.html"))) return reply.sendFile("index.html", dist);
    return reply.code(404).send({ error: { code: "not_found", message: "غير موجود" } });
  });

  for (const r of opts.routes ?? []) await r(app);

  // خدمة الواجهة المبنية (تُستخدم أيضًا من Chromium عند توليد PDF)
  const dist = ctx.cfg.WEB_DIST_DIR;
  if (dist && existsSync(path.join(dist, "index.html"))) {
    await app.register(staticFiles, { root: path.resolve(dist), wildcard: false, index: "index.html" });
  }
  return app;
}
