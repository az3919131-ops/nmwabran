import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Act, PermMap } from "@iltizam/core";
import { apiKeys, sessions, users } from "../db/schema";
import { forbidden, locked, unauthorized } from "../lib/errors";
import { sha256 } from "../lib/hash";
import { allowedContractorIds, getPerms, type UserRow } from "../repo/users";
import type { ApiScope } from "../services/types";

export interface AuthInfo {
  user: UserRow; perms: PermMap; sessionId: string | null; unlocked: boolean; typ: "access" | "print"; contractorIds: string[] | null;
}
export interface ApiKeyInfo { id: string; name: string; scopes: string[] }
declare module "fastify" {
  interface FastifyRequest { auth?: AuthInfo; apiKey?: ApiKeyInfo }
}
export const ACCESS_TTL_SEC = 15 * 60;
export const SESSION_TTL_MS = 12 * 3600 * 1000;

const secretKey = (s: string) => new TextEncoder().encode(s);
export async function signAccess(secret: string, userId: string, sid: string, role: string): Promise<string> {
  return new SignJWT({ sid, role, typ: "access" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${ACCESS_TTL_SEC}s`).sign(secretKey(secret));
}
/** رمز قصير العمر لـ Chromium عند توليد PDF — للقراءة فقط */
export async function signPrintToken(secret: string, userId: string, ttlSec = 300): Promise<string> {
  return new SignJWT({ typ: "print" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(secretKey(secret));
}
export async function signDownload(secret: string, key: string, name: string, ttlSec: number): Promise<string> {
  return new SignJWT({ typ: "download", key, name }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(secretKey(secret));
}
export async function verifyDownload(secret: string, token: string): Promise<{ key: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    if (payload.typ !== "download") return null;
    return { key: String(payload.key), name: String(payload.name) };
  } catch { return null; }
}

async function authenticate(app: FastifyInstance, req: FastifyRequest): Promise<AuthInfo | null> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  let payload;
  try { ({ payload } = await jwtVerify(h.slice(7), secretKey(app.ctx.cfg.JWT_SECRET), { algorithms: ["HS256"] })); } catch { return null; }
  const db = app.ctx.db;
  const typ = payload.typ === "print" ? "print" : "access";
  if (typ === "print" && req.method !== "GET") throw forbidden("رمز الطباعة للقراءة فقط");
  const [user] = await db.select().from(users).where(eq(users.id, String(payload.sub))).limit(1);
  if (!user || !user.active) return null;
  let unlocked = false, sessionId: string | null = null;
  if (typ === "access") {
    const [s] = await db.select().from(sessions).where(and(eq(sessions.id, String(payload.sid)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1);
    if (!s) return null;
    unlocked = s.unlocked; sessionId = s.id;
  }
  return { user, perms: await getPerms(db, user), sessionId, unlocked, typ, contractorIds: await allowedContractorIds(db, user) };
}

/** مصادقة مفتاح API (X-API-Key) — للأنظمة الخارجية */
async function authKey(app: FastifyInstance, req: FastifyRequest): Promise<ApiKeyInfo | null> {
  const k = req.headers["x-api-key"];
  if (typeof k !== "string" || !k) return null;
  const db = app.ctx.db;
  const [row] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, sha256(k)), eq(apiKeys.active, true))).limit(1);
  if (!row) return null;
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
  return { id: row.id, name: row.name, scopes: row.scopes };
}

async function checkPerm(app: FastifyInstance, req: FastifyRequest, mod: string, act: Act, opts: { ignoreLock?: boolean }): Promise<void> {
  if (!req.auth) { const a = await authenticate(app, req); if (!a) throw unauthorized(); req.auth = a; }
  const a = req.auth;
  const label = act === "view" ? "العرض" : act === "edit" ? "الإضافة/التعديل" : act === "del" ? "الحذف" : "التصدير";
  if (!a.perms[mod]?.[act]) throw forbidden(`لا تملك صلاحية «${label}» في هذه الوحدة`);
  if ((act === "edit" || act === "del") && !opts.ignoreLock && a.typ === "access" && !a.unlocked) throw locked();
}

export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest("auth", undefined);
  app.decorateRequest("apiKey", undefined);

  app.decorate("authenticate", (async (req: FastifyRequest) => {
    const a = await authenticate(app, req);
    if (!a) throw unauthorized();
    req.auth = a;
  }) as preHandlerHookHandler);

  /** requirePerm(module, action): يفرض الصلاحية في الـ API لا في الواجهة فقط، وقفل التعديل على edit/del */
  app.decorate("requirePerm", (mod: string, act: Act, opts: { ignoreLock?: boolean } = {}) => (async (req: FastifyRequest) => {
    await checkPerm(app, req, mod, act, opts);
  }) as preHandlerHookHandler);

  /** مستخدم مسجّل أو مفتاح API بنطاق محدد */
  app.decorate("requireUserOrKey", (scope: ApiScope, mod: string, act: Act, opts: { ignoreLock?: boolean } = {}) => (async (req: FastifyRequest) => {
    const key = await authKey(app, req);
    if (key) {
      if (!key.scopes.includes(scope)) throw forbidden(`مفتاح API لا يملك النطاق ${scope}`, "scope_missing");
      req.apiKey = key; return;
    }
    await checkPerm(app, req, mod, act, opts);
  }) as preHandlerHookHandler);
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    requirePerm: (mod: string, act: Act, opts?: { ignoreLock?: boolean }) => preHandlerHookHandler;
    requireUserOrKey: (scope: ApiScope, mod: string, act: Act, opts?: { ignoreLock?: boolean }) => preHandlerHookHandler;
  }
}
