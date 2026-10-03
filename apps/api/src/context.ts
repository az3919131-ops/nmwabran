import type { AppCtx } from "./app";
import type { Config } from "./config";
import type { DbHandle } from "./db/client";
import { createAi } from "./services/ai";
import { WebhookEvents } from "./services/events";
import { createMailProvider } from "./services/mail";
import { PlaywrightPdf } from "./services/reports/pdf";
import { InlineQueue, PgBossQueue } from "./services/queue";
import { createStorage } from "./services/storage";
import type { MailProvider, StorageProvider, JobQueue } from "./services/types";
import type { AiService } from "./services/ai";
import type { PdfRenderer } from "./services/reports/pdf";

export interface CtxOverrides { mail?: MailProvider; storage?: StorageProvider; ai?: AiService; pdf?: PdfRenderer | null; queue?: "inline" | "pgboss" }

/** يبني سياق التطبيق (الخدمات). الطابور يُبنى آخرًا لأنه يحتاج السياق. */
export async function buildContext(cfg: Config, h: DbHandle, o: CtxOverrides = {}): Promise<AppCtx> {
  const events = new WebhookEvents(h.db);
  const ctx = {
    cfg, h, db: h.db, mail: o.mail ?? createMailProvider(cfg), storage: o.storage ?? createStorage(cfg), ai: o.ai ?? createAi(cfg),
    pdf: o.pdf !== undefined ? o.pdf : cfg.DISABLE_PDF ? null : new PlaywrightPdf(cfg), events, queue: null as unknown as JobQueue,
  } as AppCtx;
  const mode = o.queue ?? (cfg.QUEUE_ENABLED ? "pgboss" : "inline");
  if (mode === "pgboss") { const q = new PgBossQueue(ctx, { pdf: ctx.pdf }, cfg.DATABASE_URL, cfg.QUEUE_SCHEMA); await q.start(); ctx.queue = q; }
  else ctx.queue = new InlineQueue(() => ctx, { pdf: ctx.pdf });
  events.queue = ctx.queue;
  return ctx;
}
