import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "./helpers";

let E: TestEnv;
beforeAll(async () => { E = await createTestEnv(); });
afterAll(async () => { await E.close(); });

describe("المصادقة والأمان", () => {
  it("دخول صحيح يعيد JWT وصلاحيات وكوكي refresh من نوع httpOnly", async () => {
    const r = await E.inject("POST", "/api/v1/auth/login", { body: { username: "ahmed", password: "Admin@12345" } });
    expect(r.status).toBe(200);
    expect(r.json.accessToken.split(".")).toHaveLength(3);
    expect(r.json.user).toMatchObject({ username: "ahmed", role: "admin" });
    expect(r.json.unlocked).toBe(false);                      // الجلسة تبدأ مقفلة
    const c = r.cookies.find((x) => x.name === "iltizam_rt");
    expect(c?.httpOnly).toBe(true);
    expect(c?.maxAge).toBeUndefined();                       // كوكي جلسة تزول بإغلاق المتصفح
    expect(JSON.stringify(r.json)).not.toContain("password");
  });
  it("كلمة مرور خاطئة 401 برسالة عربية، ولا تسريب لوجود المستخدم", async () => {
    const a = await E.inject("POST", "/api/v1/auth/login", { body: { username: "ahmed", password: "bad" } });
    const b = await E.inject("POST", "/api/v1/auth/login", { body: { username: "nobody", password: "bad" } });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.json.error.message).toBe(b.json.error.message);
    expect(a.json.error.message).toMatch(/غير صحيحة/);
  });
  it("لا وصول بدون رمز، ورمز مزوّر مرفوض", async () => {
    expect((await E.inject("GET", "/api/v1/bootstrap")).status).toBe(401);
    expect((await E.inject("GET", "/api/v1/bootstrap", { token: "a.b.c" })).status).toBe(401);
  });
  it("refresh يدوّر الكوكي ويعيد رمزًا جديدًا؛ وlogout يبطله", async () => {
    const { cookie } = await E.login();
    const r1 = await E.inject("POST", "/api/v1/auth/refresh", { cookies: { iltizam_rt: cookie } });
    expect(r1.status).toBe(200);
    const next = r1.cookies.find((x) => x.name === "iltizam_rt")!.value;
    expect(next).not.toBe(cookie);
    expect((await E.inject("POST", "/api/v1/auth/refresh", { cookies: { iltizam_rt: cookie } })).status).toBe(401); // القديم لم يعد صالحًا
    await E.inject("POST", "/api/v1/auth/logout", { cookies: { iltizam_rt: next } });
    expect((await E.inject("POST", "/api/v1/auth/refresh", { cookies: { iltizam_rt: next } })).status).toBe(401);
  });
  it("قفل التعديل: التعديل مرفوض 423 حتى يُفتح بكلمة مرور مدير النظام", async () => {
    const { token } = await E.login();
    const body = { name: "مقاول اختبار القفل" };
    const locked = await E.inject("POST", "/api/v1/contractors", { token, body });
    expect(locked.status).toBe(423); expect(locked.json.error.code).toBe("edit_locked");
    expect((await E.inject("POST", "/api/v1/auth/unlock", { token, body: { password: "wrong" } })).status).toBe(403);
    expect((await E.inject("POST", "/api/v1/auth/unlock", { token, body: { password: "Admin@12345" } })).status).toBe(200);
    expect((await E.inject("POST", "/api/v1/contractors", { token, body })).status).toBe(201);
    await E.inject("POST", "/api/v1/auth/lock", { token });
    expect((await E.inject("POST", "/api/v1/contractors", { token, body: { name: "x2 مقاول" } })).status).toBe(423);
  });
  it("الصلاحيات تُفرض في الـ API: pm لا يرى المستخدمين ولا يستورد", async () => {
    const { token } = await E.login("hamad", "Pm@12345");
    expect((await E.inject("GET", "/api/v1/users", { token })).status).toBe(403);
    expect((await E.inject("POST", "/api/v1/auth/unlock", { token, body: { password: "Admin@12345" } })).status).toBe(200); // يفتحه بكلمة المدير
    const [p] = (await E.inject("GET", "/api/v1/projects", { token })).json;
    const r = await E.inject("POST", `/api/v1/projects/${p.id}/derive`, { token, body: {} });
    expect(r.status).toBe(403);
  });
  it("كلمات المرور تُحفظ argon2 وليست نصًا", async () => {
    const { rows } = await E.h.pool.query("select password_hash from users");
    for (const x of rows) expect(x.password_hash).toMatch(/^\$argon2id\$/);
  });
  it("تحديد معدل محاولات الدخول", async () => {
    let last = 0;
    for (let i = 0; i < 14; i++) last = (await E.inject("POST", "/api/v1/auth/login", { body: { username: "salem", password: "nope" + i } })).status;
    expect([423, 429]).toContain(last);
  });
  it("تغيير كلمة المرور: رمز التحقق يُرسل إلى ADMIN_EMAIL ثم يُؤكَّد (5 محاولات)", async () => {
    const { token } = await E.login("hamad", "Pm@12345");
    const rq = await E.inject("POST", "/api/v1/auth/password/request", { token, body: { current: "Pm@12345", next: "NewPass#2026" } });
    expect(rq.status).toBe(200); expect(rq.json.mailed).toBe(true);
    const mail = E.mail.to("az3919131@gmail.com").at(-1)!;
    const code = /\b(\d{6})\b/.exec(mail.text!)![1];
    for (let i = 0; i < 2; i++) expect((await E.inject("POST", "/api/v1/auth/password/confirm", { token, body: { requestId: rq.json.requestId, code: "000000" } })).status).toBe(400);
    const ok = await E.inject("POST", "/api/v1/auth/password/confirm", { token, body: { requestId: rq.json.requestId, code } });
    expect(ok.status).toBe(200);
    expect((await E.inject("POST", "/api/v1/auth/login", { body: { username: "hamad", password: "NewPass#2026" } })).status).toBe(200);
    expect((await E.inject("POST", "/api/v1/auth/login", { body: { username: "hamad", password: "Pm@12345" } })).status).toBe(401);
  });
});
