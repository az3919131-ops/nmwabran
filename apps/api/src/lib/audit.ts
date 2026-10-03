import type { FastifyRequest } from "fastify";
import type { DB, Tx } from "../db/client";
import { auditLog } from "../db/schema";

export async function writeAudit(db: DB | Tx, e: { userId?: string | null; username?: string; action: string; entity?: string; entityId?: string; detail?: string; ip?: string }): Promise<void> {
  await db.insert(auditLog).values({
    userId: e.userId ?? null, username: e.username ?? "—", action: e.action, entity: e.entity ?? null, entityId: e.entityId ?? null,
    detail: (e.detail ?? "").slice(0, 2000), ip: e.ip ?? null,
  });
}
export async function audit(req: FastifyRequest, action: string, o: { entity?: string; entityId?: string; detail?: string } = {}): Promise<void> {
  const a = req.auth;
  await writeAudit(req.server.ctx.db, {
    userId: a?.user.id ?? null, username: a?.user.username ?? (req.apiKey ? "api:" + req.apiKey.name : "—"), action, ip: req.ip, ...o,
  });
}
