import { and, eq } from "drizzle-orm";
import parser from "cron-parser";
import PgBoss from "pg-boss";
import type { AppCtx } from "../app";
import type { DB } from "../db/client";
import { reportSchedules, users } from "../db/schema";
import { createReportJob, runReportJob } from "./reports/service";
import type { PdfRenderer } from "./reports/pdf";
import { deliverWebhook } from "./events";
import type { JobQueue } from "./types";

type Deps = { pdf: PdfRenderer | null };

/** تنفيذ الجداول: كل دقيقة يفحص الجداول المستحقة ويرسلها عبر نفس مسار الإرسال (بحماية ضد التكرار) */
async function runDueSchedules(ctx: AppCtx, now = new Date()): Promise<number> {
  const rows = await ctx.db.select().from(reportSchedules).where(eq(reportSchedules.active, true));
  let fired = 0;
  for (const s of rows) {
    let prev: Date;
    try { prev = parser.parseExpression(s.cron, { currentDate: now }).prev().toDate(); } catch { continue; }
    const last = s.lastRunAt ?? s.createdAt;
    if (prev <= last || prev > now) continue;
    // نحجز التنفيذ أولًا (UPDATE شرطي) حتى لا تُرسل نسختان من خادمين
    const claimed = await ctx.db.update(reportSchedules).set({ lastRunAt: prev }).where(and(eq(reportSchedules.id, s.id), eq(reportSchedules.lastRunAt, s.lastRunAt as Date))).returning({ id: reportSchedules.id }).catch(() => []);
    if (s.lastRunAt && !claimed.length) continue;
    if (!s.lastRunAt) await ctx.db.update(reportSchedules).set({ lastRunAt: prev }).where(eq(reportSchedules.id, s.id));
    try {
      const [creator] = s.createdBy ? await ctx.db.select().from(users).where(eq(users.id, s.createdBy)).limit(1) : [];
      await createReportJob(ctx, { reportKey: s.reportKey, workOrderId: s.workOrderId, lang: s.lang === "en" ? "en" : "ar", attachPdf: s.attachPdf, attachXlsx: s.attachXlsx, note: s.note ?? undefined },
        { userId: s.createdBy ?? null, isAdmin: !creator || creator.role === "admin", contractorIds: null });
      fired++;
    } catch (e) { console.error("schedule failed", s.id, e); }
  }
  return fired;
}

/** طابور pg-boss: 3 محاولات بتأخير متزايد */
export class PgBossQueue implements JobQueue {
  private boss: PgBoss;
  private timer: NodeJS.Timeout | null = null;
  constructor(private ctx: AppCtx, private deps: Deps, connectionString: string, schema: string) {
    this.boss = new PgBoss({ connectionString, schema, max: 4 });
  }
  async start(): Promise<void> {
    await this.boss.start();
    const opts = { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 600 };
    await this.boss.createQueue("report-send", { name: "report-send", ...opts });
    await this.boss.createQueue("webhook-deliver", { name: "webhook-deliver", retryLimit: 4, retryDelay: 20, retryBackoff: true });
    await this.boss.work("report-send", { batchSize: 1 }, async (jobs) => { for (const j of jobs) await runReportJob(this.ctx, (j.data as { id: string }).id, this.deps); });
    await this.boss.work("webhook-deliver", { batchSize: 1 }, async (jobs) => { for (const j of jobs) await deliverWebhook(this.ctx.db, (j.data as { id: number }).id); });
    this.timer = setInterval(() => { void runDueSchedules(this.ctx).catch(() => {}); }, 30000);
    this.timer.unref();
  }
  async enqueueReport(id: string) { await this.boss.send("report-send", { id }, { singletonKey: id }); }
  async enqueueWebhook(id: number) { await this.boss.send("webhook-deliver", { id }); }
  async syncSchedules() { /* الفحص دوري كل 30 ث — لا شيء يلزم */ }
  async stop() { if (this.timer) clearInterval(this.timer); await this.boss.stop({ graceful: true, timeout: 5000 }).catch(() => {}); }
}

/** طابور داخل العملية (للاختبارات والتشغيل البسيط بلا pg-boss): 3 محاولات بتأخير متزايد */
export class InlineQueue implements JobQueue {
  private timers = new Set<NodeJS.Timeout>();
  private pending = new Set<Promise<void>>();
  constructor(private getCtx: () => AppCtx, private deps: Deps, private delaysMs = [2000, 4000]) {}
  private run(fn: () => Promise<void>, attempt = 0) {
    const p = fn().catch((e) => {
      if (attempt < this.delaysMs.length) { const t = setTimeout(() => { this.timers.delete(t); this.run(fn, attempt + 1); }, this.delaysMs[attempt]); this.timers.add(t); t.unref(); }
      else console.error("job failed permanently", String(e?.message ?? e));
    }).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }
  async enqueueReport(id: string) { this.run(() => runReportJob(this.getCtx(), id, this.deps)); }
  async enqueueWebhook(id: number) { this.run(() => deliverWebhook(this.getCtx().db, id)); }
  async syncSchedules() {}
  /** للاختبارات: ينتظر انتهاء كل المهام الجارية */
  async idle(): Promise<void> { while (this.pending.size) await Promise.allSettled([...this.pending]); }
  async tickSchedules(now = new Date()) { return runDueSchedules(this.getCtx(), now); }
  async stop() { for (const t of this.timers) clearTimeout(t); await this.idle().catch(() => {}); }
}
export type { DB };
