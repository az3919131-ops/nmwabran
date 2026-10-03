import { and, eq } from "drizzle-orm";
import { defaultPerms, MODULE_IDS, type Act, type PermMap, type Role } from "@iltizam/core";
import type { DB, Tx } from "../db/client";
import { userContractors, userPermissions, users } from "../db/schema";

type Q = DB | Tx;
export type UserRow = typeof users.$inferSelect;

export async function getUserByUsername(db: Q, username: string): Promise<UserRow | null> {
  const r = await db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).limit(1);
  return r[0] ?? null;
}
export async function getUserById(db: Q, id: string): Promise<UserRow | null> {
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0] ?? null;
}
export async function getPerms(db: Q, user: Pick<UserRow, "id" | "role">): Promise<PermMap> {
  const base = defaultPerms(user.role as Role);
  if (user.role === "admin") return base;
  const rows = await db.select().from(userPermissions).where(eq(userPermissions.userId, user.id));
  if (!rows.length) return base;
  const out: PermMap = {};
  for (const m of MODULE_IDS) out[m] = { view: 0, edit: 0, del: 0, exp: 0 };
  for (const r of rows) if (out[r.module]) out[r.module] = { view: r.canView ? 1 : 0, edit: r.canEdit ? 1 : 0, del: r.canDel ? 1 : 0, exp: r.canExp ? 1 : 0 };
  return out;
}
export async function setPerms(db: Q, userId: string, perms: PermMap): Promise<void> {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  const rows = MODULE_IDS.map((m) => {
    const p = perms[m] ?? { view: 0, edit: 0, del: 0, exp: 0 };
    return { userId, module: m, canView: !!p.view, canEdit: !!p.edit && !!p.view, canDel: !!p.del && !!p.view, canExp: !!p.exp && !!p.view };
  });
  await db.insert(userPermissions).values(rows);
}
export const can = (perms: PermMap, mod: string, act: Act): boolean => !!perms[mod]?.[act];

/** المقاولون المسموح بهم للمستخدم: null = الكل */
export async function allowedContractorIds(db: Q, user: Pick<UserRow, "id" | "role" | "allContractors">): Promise<string[] | null> {
  if (user.role === "admin" || user.allContractors) return null;
  const r = await db.select({ c: userContractors.contractorId }).from(userContractors).where(eq(userContractors.userId, user.id));
  return r.map((x) => x.c);
}
export async function setUserContractors(db: Q, userId: string, ids: string[]): Promise<void> {
  await db.delete(userContractors).where(eq(userContractors.userId, userId));
  if (ids.length) await db.insert(userContractors).values(ids.map((c) => ({ userId, contractorId: c })));
}
export async function userHasContractor(db: Q, user: Pick<UserRow, "id" | "role" | "allContractors">, contractorId: string): Promise<boolean> {
  if (user.role === "admin" || user.allContractors) return true;
  const r = await db.select().from(userContractors).where(and(eq(userContractors.userId, user.id), eq(userContractors.contractorId, contractorId))).limit(1);
  return r.length > 0;
}
