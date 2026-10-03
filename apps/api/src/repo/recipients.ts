import { eq, sql } from "drizzle-orm";
import type { DB, Tx } from "../db/client";
import { emailRecipients } from "../db/schema";

/** مدير النظام (ADMIN_EMAIL): يُنشأ تلقائيًا عند الإقلاع إن لم يوجد — idempotent upsert */
export async function ensureSystemRecipient(db: DB | Tx, adminEmail: string): Promise<void> {
  const email = adminEmail.trim().toLowerCase();
  await db.insert(emailRecipients).values({ email, name: "مدير النظام", roleLabel: "مدير النظام", active: true, isSystem: true })
    .onConflictDoUpdate({
      target: emailRecipients.email,
      set: { isSystem: true, active: true, updatedAt: new Date(), name: sql`CASE WHEN ${emailRecipients.name} = '' THEN 'مدير النظام' ELSE ${emailRecipients.name} END` },
    });
  // لو تغيّر ADMIN_EMAIL: يبقى السجل القديم مستلمًا عاديًا (لا نحذف شيئًا) ويُنزع عنه وسم النظام
  await db.update(emailRecipients).set({ isSystem: false, updatedAt: new Date() }).where(sql`${emailRecipients.isSystem} AND ${emailRecipients.email} <> ${email}`);
}
export async function systemRecipient(db: DB | Tx, adminEmail: string) {
  const r = await db.select().from(emailRecipients).where(eq(emailRecipients.email, adminEmail.trim().toLowerCase())).limit(1);
  return r[0] ?? null;
}
