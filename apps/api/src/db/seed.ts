import { eq } from "drizzle-orm";
import { defaultPerms, hassiniya, type Role } from "@iltizam/core";
import type { Config } from "../config";
import { hashPassword } from "../lib/hash";
import { loadCatalog, seedCatalog } from "../repo/catalog";
import { insertProject } from "../repo/projects";
import { ensureSystemRecipient } from "../repo/recipients";
import { setPerms } from "../repo/users";
import type { DB } from "./client";
import { contractors, users, workOrders } from "./schema";

export const SEED_CONTRACTOR = "شركة ناصر مانع وبران وشركاه";
const DEV_PASSWORDS = { admin: "Admin@12345", dept: "Dept@12345", pm: "Pm@12345" };

/** يُشغَّل عند كل إقلاع — كله idempotent */
export async function seedAll(db: DB, cfg: Config, log: { info: (m: string) => void; warn: (m: string) => void } = console as any): Promise<void> {
  await seedCatalog(db);
  await ensureSystemRecipient(db, cfg.ADMIN_EMAIL);

  // المقاول
  let [con] = await db.select().from(contractors).where(eq(contractors.name, SEED_CONTRACTOR)).limit(1);
  const anyContractor = await db.select({ id: contractors.id }).from(contractors).limit(1);
  if (!con && !anyContractor.length) {
    [con] = await db.insert(contractors).values({ name: SEED_CONTRACTOR, sortOrder: 0 }).returning();
  }

  // المستخدمون الثلاثة الافتراضيون كما في المنصة الحالية (admin / dept / pm)
  const have = await db.select({ id: users.id }).from(users).limit(1);
  if (!have.length) {
    const prod = cfg.NODE_ENV === "production";
    const pw = {
      admin: cfg.SEED_ADMIN_PASSWORD || (prod ? "" : DEV_PASSWORDS.admin),
      dept: cfg.SEED_DEPT_PASSWORD || (prod ? "" : DEV_PASSWORDS.dept),
      pm: cfg.SEED_PM_PASSWORD || (prod ? "" : DEV_PASSWORDS.pm),
    };
    const seeds: { u: string; name: string; role: Role; pw: string }[] = [
      { u: cfg.SEED_ADMIN_USER, name: "م. حمد خليفة", role: "admin", pw: pw.admin },
      { u: "salem", name: "سالم", role: "dept", pw: pw.dept },
      { u: "hamad", name: "م. محمد", role: "pm", pw: pw.pm },
    ];
    for (const s of seeds) {
      if (!s.pw) { log.warn(`تخطّي إنشاء المستخدم ${s.u}: لم تُضبط كلمة المرور الأولية في البيئة`); continue; }
      const [u] = await db.insert(users).values({ username: s.u.toLowerCase(), name: s.name, role: s.role, passwordHash: await hashPassword(s.pw) }).returning();
      await setPerms(db, u.id, defaultPerms(s.role));
    }
    log.info("زُرع المستخدمون الافتراضيون (admin / dept / pm)");
  }

  // مشروع الحصينية ببياناته الكاملة
  if (cfg.SEED_DEMO_DATA) {
    const wo = await db.select({ id: workOrders.id }).from(workOrders).limit(1);
    const first = con ?? (await db.select().from(contractors).limit(1))[0];
    if (!wo.length && first) {
      const p = hassiniya();
      const cat = await loadCatalog(db);
      void cat;
      await db.transaction(async (tx) => { await insertProject(tx, { ...p, contractorId: first.id }, { derived: true }); });
      log.info("زُرع مشروع «تحويل طريق الحصينية» أمر عمل 234022308");
    }
  }
}
