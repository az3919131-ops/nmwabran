import { asc, desc, eq, gte, sql } from "drizzle-orm";
import { type Catalog, type Lang, type Project } from "@iltizam/core";
import type { AppCtx } from "../../app";
import { auditLog, contractors, emailLog, emailRecipients, users } from "../../db/schema";
import { loadCatalog } from "../../repo/catalog";
import { listProjects, loadProject, type ApiProject } from "../../repo/projects";

export interface ReportData {
  lang: Lang; cat: Catalog;
  /** المشروع المرجعي للتقرير (قد يكون null للتقارير العامة: users/emails) */
  project: ApiProject | null;
  contractorId: string | null; contractorName: string;
  /** مشاريع المقاول المرجعي */
  mine: ApiProject[];
  /** كل المشاريع المتاحة لصاحب الطلب */
  all: ApiProject[];
  contractors: { id: string; name: string }[];
  recipients: { email: string; name: string; roleLabel: string; active: boolean; isSystem: boolean }[];
  sendLog: { createdAt: Date; reportKey: string; status: string; recipients: unknown; subject: string; sentAt: Date | null }[];
  users: { username: string; name: string; role: string; active: boolean }[];
  auditCount: number;
}

/** يحمّل كل ما تحتاجه تقارير الصفحات. contractorIds=null يعني كل المقاولين (النظام/الجدولة/مدير النظام). */
export async function loadReportData(ctx: AppCtx, o: { workOrderId?: string | null; lang: Lang; contractorIds: string[] | null; includeAdmin?: boolean }): Promise<ReportData> {
  const db = ctx.db;
  const cat = await loadCatalog(db);
  const all = await listProjects(db, cat, o.contractorIds);
  const cs = await db.select().from(contractors).orderBy(asc(contractors.sortOrder), asc(contractors.createdAt));
  let project: ApiProject | null = null;
  if (o.workOrderId) project = (await loadProject(db, o.workOrderId, cat)) ?? null;
  const contractorId = project?.contractorId ?? all[0]?.contractorId ?? null;
  const d: ReportData = {
    lang: o.lang, cat, project, contractorId, contractorName: cs.find((c) => c.id === contractorId)?.name ?? "",
    mine: all.filter((p) => p.contractorId === contractorId), all, contractors: cs.map((c) => ({ id: c.id, name: c.name })),
    recipients: [], sendLog: [], users: [], auditCount: 0,
  };
  if (o.includeAdmin) {
    d.recipients = (await db.select().from(emailRecipients).orderBy(asc(emailRecipients.createdAt))).map((r) => ({ email: r.email, name: r.name, roleLabel: r.roleLabel, active: r.active, isSystem: r.isSystem }));
    d.sendLog = (await db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(100)).map((l) => ({ createdAt: l.createdAt, reportKey: l.reportKey, status: l.status, recipients: l.recipients, subject: l.subject, sentAt: l.sentAt }));
    d.users = (await db.select().from(users).orderBy(users.createdAt)).map((u) => ({ username: u.username, name: u.name, role: u.role, active: u.active }));
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
    d.auditCount = n;
  }
  void eq; void gte;
  return d;
}
export type { Project };
