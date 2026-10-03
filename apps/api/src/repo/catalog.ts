import { eq, inArray } from "drizzle-orm";
import { DEFAULT_CATALOG, type Catalog, type Material, type Work } from "@iltizam/core";
import type { DB, Tx } from "../db/client";
import { catalogMaterials, catalogWorks } from "../db/schema";

const n = (x: string | number | null | undefined) => (x == null ? 0 : Number(x));

/** يزرع المكتبة الافتراضية (العقد الموحد 2023) إن كانت فارغة — idempotent */
export async function seedCatalog(db: DB | Tx): Promise<void> {
  const have = await db.select({ code: catalogMaterials.code }).from(catalogMaterials).limit(1);
  if (!have.length) {
    await db.insert(catalogMaterials).values(DEFAULT_CATALOG.materials.map((m) => ({
      code: m.c, ar: m.ar, en: m.en, unit: m.u, price: String(m.p), klass: m.k, grp: m.g, added: false,
    })));
  }
  const haveW = await db.select({ code: catalogWorks.code }).from(catalogWorks).limit(1);
  if (!haveW.length) {
    await db.insert(catalogWorks).values(DEFAULT_CATALOG.works.map((w) => ({
      code: w.c, ar: w.ar, en: w.en, unit: w.u, price: String(w.p), grp: w.g, added: false,
    })));
  }
}

export async function loadCatalog(db: DB | Tx): Promise<Catalog> {
  const [ms, ws] = await Promise.all([db.select().from(catalogMaterials), db.select().from(catalogWorks)]);
  // نحافظ على ترتيب المكتبة الافتراضية أولًا ثم المضافة (يتطابق مع ترتيب المنصة الحالية)
  const order = new Map<string, number>();
  DEFAULT_CATALOG.materials.forEach((m, i) => order.set("m" + m.c, i));
  DEFAULT_CATALOG.works.forEach((w, i) => order.set("w" + w.c, i));
  const materials: Material[] = ms.map((m) => ({ c: m.code, ar: m.ar, en: m.en, u: m.unit, p: n(m.price), k: m.klass as "main" | "detail", g: m.grp, ...(m.added ? { added: true } : {}) }))
    .sort((a, b) => (order.get("m" + a.c) ?? 1e6) - (order.get("m" + b.c) ?? 1e6));
  const works: Work[] = ws.map((w) => ({ c: w.code, ar: w.ar, en: w.en, u: w.unit, p: n(w.price), g: w.grp, ...(w.added ? { added: true } : {}) }))
    .sort((a, b) => (order.get("w" + a.c) ?? 1e6) - (order.get("w" + b.c) ?? 1e6));
  return { materials, works };
}

/** يحفظ ما تغيّر في المكتبة بعد الاستيراد (بنود جديدة وأسعار محدّثة) */
export async function persistCatalogDiff(db: DB | Tx, before: Catalog, after: Catalog): Promise<{ addedM: number; addedW: number; priced: number }> {
  let addedM = 0, addedW = 0, priced = 0;
  const bm = new Map(before.materials.map((m) => [m.c, m])), bw = new Map(before.works.map((w) => [w.c, w]));
  for (const m of after.materials) {
    const o = bm.get(m.c);
    if (!o) {
      await db.insert(catalogMaterials).values({ code: m.c, ar: m.ar, en: m.en, unit: m.u, price: String(m.p), klass: m.k, grp: m.g, added: true }).onConflictDoNothing();
      addedM++;
    } else if (o.p !== m.p || o.en !== m.en) {
      await db.update(catalogMaterials).set({ price: String(m.p), en: m.en, updatedAt: new Date() }).where(eq(catalogMaterials.code, m.c));
      priced++;
    }
  }
  for (const w of after.works) {
    const o = bw.get(w.c);
    if (!o) {
      await db.insert(catalogWorks).values({ code: w.c, ar: w.ar, en: w.en, unit: w.u, price: String(w.p), grp: w.g, added: true }).onConflictDoNothing();
      addedW++;
    } else if (o.p !== w.p) {
      await db.update(catalogWorks).set({ price: String(w.p), updatedAt: new Date() }).where(eq(catalogWorks.code, w.c));
      priced++;
    }
  }
  return { addedM, addedW, priced };
}
void inArray;
