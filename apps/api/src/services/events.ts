import { and, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { webhookDeliveries, webhookEndpoints } from "../db/schema";
import { hmacHex } from "../lib/hash";
import type { AppEvents, JobQueue } from "./types";

/** Webhooks صادرة: توقيع HMAC-SHA256 للجسم في ترويسة X-Signature (sha256=...) */
export class WebhookEvents implements AppEvents {
  queue: JobQueue | null = null;
  constructor(private db: DB) {}
  async emit(event: string, payload: Record<string, unknown>): Promise<void> {
    const eps = await this.db.select().from(webhookEndpoints).where(and(eq(webhookEndpoints.active, true), sql`${event} = ANY(${webhookEndpoints.events})`));
    for (const ep of eps) {
      const [d] = await this.db.insert(webhookDeliveries).values({ endpointId: ep.id, event, payload: { event, at: new Date().toISOString(), data: payload } }).returning({ id: webhookDeliveries.id });
      if (this.queue) await this.queue.enqueueWebhook(d.id); else await deliverWebhook(this.db, d.id).catch(() => {});
    }
  }
}

/** يسلّم webhook واحدًا؛ يرمي عند الفشل ليُعاد من الطابور */
export async function deliverWebhook(db: DB, deliveryId: number): Promise<void> {
  const [d] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId)).limit(1);
  if (!d || d.status === "delivered") return;
  const [ep] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, d.endpointId)).limit(1);
  if (!ep || !ep.active) { await db.update(webhookDeliveries).set({ status: "cancelled" }).where(eq(webhookDeliveries.id, deliveryId)); return; }
  const body = JSON.stringify(d.payload);
  try {
    const r = await fetch(ep.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Signature": "sha256=" + hmacHex(ep.secret, body), "X-Event": d.event, "X-Delivery": String(d.id), "User-Agent": "iltizam-webhooks/1" }, body, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    await db.update(webhookDeliveries).set({ status: "delivered", attempts: d.attempts + 1, responseCode: r.status, deliveredAt: new Date(), error: null }).where(eq(webhookDeliveries.id, deliveryId));
  } catch (e: any) {
    await db.update(webhookDeliveries).set({ status: "failed", attempts: d.attempts + 1, error: String(e?.message ?? e).slice(0, 300) }).where(eq(webhookDeliveries.id, deliveryId));
    throw e;
  }
}
