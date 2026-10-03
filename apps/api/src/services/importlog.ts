import type { DB, Tx } from "../db/client";
import { importLog } from "../db/schema";

export async function importLogWrite(db: DB | Tx, e: { projectId: string; userId?: string | null; kind: string; summary: string; report: unknown[]; fileId?: string }): Promise<void> {
  await db.insert(importLog).values({ workOrderId: e.projectId, userId: e.userId ?? null, kind: e.kind, summary: e.summary.slice(0, 500), report: e.report as never, fileId: e.fileId ?? null });
}
