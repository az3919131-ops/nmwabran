import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { ROLES, type Role } from "@iltizam/core";
import { passwordResets, sessions, users } from "../db/schema";
import { audit, writeAudit } from "../lib/audit";
import { badRequest, forbidden, HttpError, notFound, unauthorized } from "../lib/errors";
import { code6, hashPassword, randomToken, sha256, verifyPassword } from "../lib/hash";
import { ACCESS_TTL_SEC, SESSION_TTL_MS, signAccess } from "../plugins/auth";
import { getPerms, getUserById, getUserByUsername } from "../repo/users";
import type { AppCtx } from "../app";

export const COOKIE = "iltizam_rt";
// تجزئة وهمية لتسوية زمن الرد عند اسم مستخدم غير موجود
let DUMMY: string | null = null;

const MAX_FAILS = 5, LOCK_MIN = 15, MIN_PW = 8;

function setCookie(ctx: AppCtx, reply: FastifyReply, token: string) {
  // كوكي جلسة (بلا Max-Age): تزول بإغلاق المتصفح
  reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: ctx.cfg.COOKIE_SECURE, path: "/api/v1/auth" });
}
export const publicUser = (u: { id: string; username: string; name: string; role: string; active: boolean; allContractors?: boolean }) => ({
  id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, allContractors: u.allContractors ?? true,
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const ctx = app.ctx, db = ctx.db;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tag = ["auth"];

  r.post("/api/v1/auth/login", {
    schema: { tags: tag, summary: "تسجيل الدخول", body: z.object({ username: z.string().min(1).max(60), password: z.string().min(1).max(200) }) },
    config: { rateLimit: { max: 10, timeWindow: "1 minute", keyGenerator: (req: any) => `${req.ip}|${String(req.body?.username ?? "").toLowerCase()}` } },
  }, async (req, reply) => {
    const { username, password } = req.body;
    const u = await getUserByUsername(db, username);
    if (!u) {
      DUMMY ??= await hashPassword("dummy-password");
      await verifyPassword(DUMMY, password);
      await writeAudit(db, { username, action: "login_fail", detail: "unknown user", ip: req.ip });
      throw new HttpError(401, "اسم المستخدم أو كلمة المرور غير صحيحة", "bad_credentials");
    }
    if (u.lockedUntil && u.lockedUntil > new Date()) throw new HttpError(423, "الحساب مقفل مؤقتًا بسبب محاولات فاشلة — حاول لاحقًا", "account_locked");
    const ok = await verifyPassword(u.passwordHash, password);
    if (!ok) {
      const fails = u.failedLogins + 1;
      await db.update(users).set(fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MIN * 60000) } : { failedLogins: fails }).where(eq(users.id, u.id));
      await writeAudit(db, { userId: u.id, username: u.username, action: "login_fail", ip: req.ip });
      throw new HttpError(401, "اسم المستخدم أو كلمة المرور غير صحيحة", "bad_credentials");
    }
    if (!u.active) throw forbidden("هذا الحساب موقوف — راجع مدير النظام", "account_suspended");
    await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
    const rt = randomToken();
    const [s] = await db.insert(sessions).values({ userId: u.id, tokenHash: sha256(rt), expiresAt: new Date(Date.now() + SESSION_TTL_MS), ip: req.ip, userAgent: String(req.headers["user-agent"] ?? "").slice(0, 200) }).returning();
    await writeAudit(db, { userId: u.id, username: u.username, action: "login", detail: u.name, ip: req.ip });
    setCookie(ctx, reply, rt);
    return { accessToken: await signAccess(ctx.cfg.JWT_SECRET, u.id, s.id, u.role), expiresIn: ACCESS_TTL_SEC, user: publicUser(u), perms: await getPerms(db, u), unlocked: false, adminEmail: ctx.cfg.ADMIN_EMAIL };
  });

  r.post("/api/v1/auth/refresh", { schema: { tags: tag, summary: "تجديد رمز الوصول من كوكي refresh (httpOnly)" }, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    const rt = req.cookies[COOKIE];
    if (!rt) throw unauthorized("لا توجد جلسة");
    const [s] = await db.select().from(sessions).where(and(eq(sessions.tokenHash, sha256(rt)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1);
    if (!s) { reply.clearCookie(COOKIE, { path: "/api/v1/auth" }); throw unauthorized("انتهت الجلسة"); }
    const u = await getUserById(db, s.userId);
    if (!u || !u.active) throw unauthorized("انتهت الجلسة");
    const next = randomToken();
    await db.update(sessions).set({ tokenHash: sha256(next) }).where(eq(sessions.id, s.id));
    setCookie(ctx, reply, next);
    return { accessToken: await signAccess(ctx.cfg.JWT_SECRET, u.id, s.id, u.role), expiresIn: ACCESS_TTL_SEC, user: publicUser(u), perms: await getPerms(db, u), unlocked: s.unlocked, adminEmail: ctx.cfg.ADMIN_EMAIL };
  });

  r.post("/api/v1/auth/logout", { schema: { tags: tag, summary: "تسجيل الخروج" } }, async (req, reply) => {
    const rt = req.cookies[COOKIE];
    if (rt) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(rt)));
    reply.clearCookie(COOKIE, { path: "/api/v1/auth" });
    return { ok: true };
  });

  r.get("/api/v1/auth/me", { schema: { tags: tag, summary: "المستخدم الحالي وصلاحياته" }, preHandler: app.authenticate }, async (req) => {
    const a = req.auth!;
    return { user: publicUser(a.user), perms: a.perms, unlocked: a.unlocked, adminEmail: ctx.cfg.ADMIN_EMAIL, roles: ROLES };
  });

  /* ── قفل التعديل: الجلسة تبدأ مقفلة، ويُفتح بكلمة مرور مدير النظام ── */
  r.post("/api/v1/auth/unlock", {
    schema: { tags: tag, summary: "فتح قفل التعديل بكلمة مرور مدير النظام", body: z.object({ password: z.string().min(1).max(200) }) },
    preHandler: app.authenticate, config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req) => {
    const admins = await db.select().from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
    let ok = false;
    for (const a of admins) if (await verifyPassword(a.passwordHash, req.body.password)) ok = true;
    if (!ok) { await audit(req, "unlock_fail"); throw new HttpError(403, "كلمة مرور مدير النظام غير صحيحة", "bad_admin_password"); }
    await db.update(sessions).set({ unlocked: true }).where(eq(sessions.id, req.auth!.sessionId!));
    await audit(req, "unlock", { detail: req.auth!.user.name });
    return { unlocked: true };
  });
  r.post("/api/v1/auth/lock", { schema: { tags: tag, summary: "إعادة قفل التعديل" }, preHandler: app.authenticate }, async (req) => {
    await db.update(sessions).set({ unlocked: false }).where(eq(sessions.id, req.auth!.sessionId!));
    await audit(req, "lock");
    return { unlocked: false };
  });

  /* ── تغيير كلمة المرور: رمز تحقق يُرسل إلى ADMIN_EMAIL (30 دقيقة، 5 محاولات) ── */
  r.post("/api/v1/auth/password/request", {
    schema: { tags: tag, summary: "طلب تغيير كلمة المرور (يُرسل الرمز إلى بريد مدير النظام)", body: z.object({ current: z.string().min(1), next: z.string().min(MIN_PW, `كلمة المرور الجديدة ${MIN_PW} أحرف فأكثر`).max(200) }) },
    preHandler: app.authenticate, config: { rateLimit: { max: 6, timeWindow: "10 minutes" } },
  }, async (req) => {
    const u = req.auth!.user;
    if (!(await verifyPassword(u.passwordHash, req.body.current))) { await audit(req, "pw_bad_current"); throw badRequest("كلمة المرور الحالية غير صحيحة", "bad_current"); }
    const code = code6();
    const id = crypto.randomUUID();
    const exp = new Date(Date.now() + 30 * 60 * 1000);
    const text = `محفظة الالتزام — Compliance Vault\nطلب تغيير كلمة مرور\n\nالمستخدم: ${u.name} (${u.username})\nالدور: ${ROLES[u.role as Role].ar}\nرمز التحقق: ${code}\nصالح حتى: ${exp.toISOString()}\nرقم الطلب: ${id}\n\nإن لم يكن هذا الطلب منك، تجاهل الرسالة ولن يتغير شيء.\n\nمحفظة الالتزام · Project manager · Eng. Ahmed Zahran`;
    const sent = await ctx.mail.send({ to: [ctx.cfg.ADMIN_EMAIL], subject: `[محفظة الالتزام] رمز تغيير كلمة مرور — ${u.name} (${u.username})`, html: `<div dir="rtl" style="font-family:Tahoma,Arial">${text.replace(/\n/g, "<br>")}</div>`, text });
    await db.insert(passwordResets).values({ id, userId: u.id, codeHash: sha256(id + ":" + code), newHash: await hashPassword(req.body.next), expiresAt: exp, status: sent.ok ? "sent" : "pending", mailError: sent.ok ? null : (sent.error ?? "mail").slice(0, 300) });
    await audit(req, "pw_request", { entityId: id, detail: sent.ok ? "emailed" : "pending" });
    return { requestId: id, status: sent.ok ? "sent" : "pending", mailed: sent.ok, expiresAt: exp.toISOString() };
  });
  r.post("/api/v1/auth/password/confirm", {
    schema: { tags: tag, summary: "تأكيد التغيير بالرمز", body: z.object({ requestId: z.string().uuid(), code: z.string().regex(/^\d{6}$/, "الرمز 6 أرقام") }) },
    preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
  }, async (req) => {
    const [pr] = await db.select().from(passwordResets).where(and(eq(passwordResets.id, req.body.requestId), eq(passwordResets.userId, req.auth!.user.id))).limit(1);
    if (!pr) throw notFound("الطلب غير موجود");
    if (pr.status === "done") throw badRequest("هذا الطلب نُفّذ بالفعل", "already_done");
    if (!["sent", "pending"].includes(pr.status)) throw badRequest("الطلب غير صالح", "invalid_request");
    if (pr.expiresAt < new Date()) { await db.update(passwordResets).set({ status: "expired" }).where(eq(passwordResets.id, pr.id)); throw badRequest("انتهت صلاحية الرمز — ابدأ طلبًا جديدًا", "expired"); }
    if (pr.tries >= 5) { await db.update(passwordResets).set({ status: "blocked" }).where(eq(passwordResets.id, pr.id)); throw badRequest("استُنفدت المحاولات — راجع مدير النظام", "blocked"); }
    if (sha256(pr.id + ":" + req.body.code) !== pr.codeHash) {
      await db.update(passwordResets).set({ tries: pr.tries + 1 }).where(eq(passwordResets.id, pr.id));
      await audit(req, "pw_code_bad", { entityId: pr.id });
      throw badRequest(`الرمز غير صحيح — المحاولات المتبقية ${4 - pr.tries}`, "bad_code", { attemptsLeft: 4 - pr.tries });
    }
    await applyReset(app, pr.id, req.auth!.user.username, req.auth!.sessionId);
    await audit(req, "pw_changed", { entityId: pr.id });
    return { ok: true };
  });
  // اعتماد/رفض مدير النظام للطلبات المعلّقة
  r.get("/api/v1/auth/password/requests", { schema: { tags: tag, summary: "طلبات تغيير كلمة المرور (مدير النظام)" }, preHandler: app.requirePerm("users", "view") }, async () => {
    const rows = await db.select().from(passwordResets).where(gt(passwordResets.createdAt, new Date(Date.now() - 7 * 86400000))).orderBy(desc(passwordResets.createdAt)).limit(40);
    const us = await db.select().from(users);
    return rows.map((x) => ({ id: x.id, user: us.find((u) => u.id === x.userId)?.username ?? "?", name: us.find((u) => u.id === x.userId)?.name ?? "", status: x.status, mailError: x.mailError, expiresAt: x.expiresAt, createdAt: x.createdAt, tries: x.tries }));
  });
  r.post("/api/v1/auth/password/requests/:id/approve", { schema: { tags: tag, params: z.object({ id: z.string().uuid() }) }, preHandler: app.requirePerm("users", "edit") }, async (req) => {
    const [pr] = await db.select().from(passwordResets).where(eq(passwordResets.id, req.params.id)).limit(1);
    if (!pr || !["sent", "pending"].includes(pr.status)) throw notFound("الطلب غير موجود أو نُفّذ");
    await applyReset(app, pr.id, req.auth!.user.username);
    await audit(req, "pw_approved", { entityId: pr.id });
    return { ok: true };
  });
  r.post("/api/v1/auth/password/requests/:id/reject", { schema: { tags: tag, params: z.object({ id: z.string().uuid() }) }, preHandler: app.requirePerm("users", "edit") }, async (req) => {
    await db.update(passwordResets).set({ status: "rejected" }).where(eq(passwordResets.id, req.params.id));
    await audit(req, "pw_rejected", { entityId: req.params.id });
    return { ok: true };
  });
}

async function applyReset(app: FastifyInstance, id: string, by: string, keepSession: string | null = null): Promise<void> {
  const { db, mail, cfg } = app.ctx;
  const [pr] = await db.select().from(passwordResets).where(eq(passwordResets.id, id)).limit(1);
  if (!pr) return;
  const [u] = await db.select().from(users).where(eq(users.id, pr.userId)).limit(1);
  await db.update(users).set({ passwordHash: pr.newHash, updatedAt: new Date() }).where(eq(users.id, pr.userId));
  await db.update(passwordResets).set({ status: "done" }).where(eq(passwordResets.id, id));
  // أنهِ بقية جلسات المستخدم
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, pr.userId), isNull(sessions.revokedAt), keepSession ? ne(sessions.id, keepSession) : undefined));
  void mail.send({ to: [cfg.ADMIN_EMAIL], subject: `[محفظة الالتزام] تم تغيير كلمة مرور — ${u?.name} (${u?.username})`, html: `<div dir="rtl">تم تغيير كلمة مرور المستخدم ${u?.name} (${u?.username}) بنجاح بواسطة ${by}.<br>رقم الطلب: ${id}<br><br>Project manager · Eng. Ahmed Zahran</div>` }).catch(() => {});
}
