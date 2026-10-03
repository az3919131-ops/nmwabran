import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createTestEnv, type TestEnv } from "./helpers";

let E: TestEnv, tok: string, projectId: string;
const ADMIN = "az3919131@gmail.com";
beforeAll(async () => {
  E = await createTestEnv();
  tok = await E.unlockedToken();
  projectId = (await E.inject("GET", "/api/v1/projects", { token: tok })).json[0].id;
});
afterAll(async () => { await E.close(); });

const send = (key: string, body: Record<string, unknown> = {}, token = tok) => E.inject("POST", `/api/v1/reports/${key}/send`, { token, body: { workOrderId: projectId, lang: "ar", attachPdf: false, attachXlsx: true, ...body } });
const waitJob = async (id: string, token = tok) => { await E.idle(); return (await E.inject("GET", `/api/v1/reports/jobs/${id}`, { token })).json; };

describe("قائمة المستلمين", () => {
  it("مدير النظام مزروع: az3919131@gmail.com إلزامي ومفعّل", async () => {
    const r = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json;
    const a = r.items.find((x: any) => x.email === ADMIN);
    expect(a).toMatchObject({ name: "مدير النظام", active: true, isSystem: true });
    expect(r.summary.total).toBe(1);
  });
  it("إضافة: تحقق الصيغة، منع التكرار (بلا حساسية للحالة)، رسائل عربية", async () => {
    const bad = await E.inject("POST", "/api/v1/email-recipients", { token: tok, body: { email: "not-an-email", name: "x" } });
    expect(bad.status).toBe(400);
    const ok = await E.inject("POST", "/api/v1/email-recipients", { token: tok, body: { email: "Consultant@Example.com", name: "استشاري", roleLabel: "استشاري" } });
    expect(ok.status).toBe(201); expect(ok.json.email).toBe("consultant@example.com");
    const dup = await E.inject("POST", "/api/v1/email-recipients", { token: tok, body: { email: "CONSULTANT@example.com", name: "تكرار" } });
    expect(dup.status).toBe(409); expect(dup.json.error.message).toBe("هذا البريد مسجّل بالفعل");
    const dupAdmin = await E.inject("POST", "/api/v1/email-recipients", { token: tok, body: { email: "AZ3919131@gmail.com", name: "x" } });
    expect(dupAdmin.status).toBe(409);
  });
  it("إضافة جماعية: تقبل الصحيح وتتخطى المكرر والخاطئ", async () => {
    const r = await E.inject("POST", "/api/v1/email-recipients/bulk", { token: tok, body: { items: [{ email: "a1@x.com", name: "أ" }, { email: "A1@x.com" }, { email: "bad" }, { email: "consultant@example.com" }, { email: "a2@x.com" }] } });
    expect(r.json.added).toBe(2);
    expect(r.json.skipped.map((s: any) => s.email).sort()).toEqual(["a1@x.com", "bad", "consultant@example.com"].sort());
  });
  it("المستلم الإلزامي: لا حذف ولا تعطيل ولا تغيير بريد (403 بالعربية) — الاسم فقط", async () => {
    const id = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json.items.find((x: any) => x.isSystem).id;
    const del = await E.inject("DELETE", `/api/v1/email-recipients/${id}`, { token: tok });
    expect(del.status).toBe(403); expect(del.json.error.message).toMatch(/مستلم إلزامي/);
    expect((await E.inject("PATCH", `/api/v1/email-recipients/${id}`, { token: tok, body: { active: false } })).status).toBe(403);
    expect((await E.inject("PATCH", `/api/v1/email-recipients/${id}`, { token: tok, body: { email: "other@x.com" } })).status).toBe(403);
    const ren = await E.inject("PATCH", `/api/v1/email-recipients/${id}`, { token: tok, body: { name: "مدير النظام (أ. أحمد)" } });
    expect(ren.status).toBe(200); expect(ren.json.name).toBe("مدير النظام (أ. أحمد)");
    expect((await E.inject("PUT", `/api/v1/email-recipients/${id}/scope`, { token: tok, body: { reportKey: "boq", allowed: false } })).status).toBe(403);
  });
  it("صلاحيات: pm عرض فقط، dept يضيف ويعدّل ولا يحذف", async () => {
    const pm = (await E.login("hamad", "Pm@12345")).token, dept = (await E.login("salem", "Dept@12345")).token;
    expect((await E.inject("GET", "/api/v1/email-recipients", { token: pm })).status).toBe(200);
    expect((await E.inject("POST", "/api/v1/email-recipients", { token: pm, body: { email: "pm@x.com" } })).status).toBe(403);
    await E.inject("POST", "/api/v1/auth/unlock", { token: dept, body: { password: "Admin@12345" } });
    const add = await E.inject("POST", "/api/v1/email-recipients", { token: dept, body: { email: "dept-added@x.com", name: "من القسم" } });
    expect(add.status).toBe(201);
    expect((await E.inject("DELETE", `/api/v1/email-recipients/${add.json.id}`, { token: dept })).status).toBe(403);
    await E.inject("DELETE", `/api/v1/email-recipients/${add.json.id}`, { token: tok });
  });
});

describe("إرسال التقرير", () => {
  it("202 + jobId، ثم يصل التقرير للمدير وللمستلمين النشطين بمرفق Excel صالح", async () => {
    E.mail.sent.length = 0;
    const r = await send("boq");
    expect(r.status).toBe(202);
    const job = await waitJob(r.json.jobId);
    expect(job.status).toBe("sent");
    const emails = job.perRecipient.map((x: any) => x.email).sort();
    expect(emails).toContain(ADMIN); expect(emails).toContain("consultant@example.com");
    for (const x of job.perRecipient) expect(x.status).toBe("sent");
    const m = E.mail.to(ADMIN)[0];
    expect(m.subject).toBe("[محفظة الالتزام] المقايسة والمقارنة — مشروع تحويل طريق الحصينية — W/O 234022308");
    expect(m.html).toContain("Project manager"); expect(m.html).toContain("Eng. Ahmed Zahran");
    expect(m.html).toContain("أُرسل تلقائيًا من محفظة الالتزام");
    expect(m.html).toContain('dir="rtl"');
    const xl = m.attachments!.find((a) => a.filename.endsWith(".xlsx"))!;
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(xl.content as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["المقايسة والمقارنة", "موازنة المواد"]);
    const ws = wb.worksheets[0];
    expect(ws.views[0]).toMatchObject({ rightToLeft: true, state: "frozen", ySplit: 1 });
    expect(typeof ws.getRow(2).getCell(5).value).toBe("number");        // أرقام فعلية لا نصوص
    const last = ws.getRow(ws.rowCount); const rows = [ws.getRow(ws.rowCount - 1).getCell(2).value, last.getCell(2).value];
    expect(rows.join("|")).toContain("Eng. Ahmed Zahran");
  });
  it("ADMIN_EMAIL يُضاف برمجيًا حتى لو حُذف السجل يدويًا من الجدول", async () => {
    await E.h.pool.query("delete from email_recipients where email = $1", [ADMIN]);
    E.mail.sent.length = 0;
    const job = await waitJob((await send("qty")).json.jobId);
    expect(job.perRecipient.map((x: any) => x.email)).toContain(ADMIN);
    expect(E.mail.to(ADMIN).length).toBe(1);
    // ويُعاد إنشاؤه تلقائيًا عند الإقلاع (upsert idempotent)
    const { ensureSystemRecipient } = await import("../src/repo/recipients");
    await ensureSystemRecipient(E.h.db, ADMIN); await ensureSystemRecipient(E.h.db, ADMIN);
    const r = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json;
    expect(r.items.filter((x: any) => x.email === ADMIN)).toHaveLength(1);
    expect(r.items.find((x: any) => x.email === ADMIN).isSystem).toBe(true);
  });
  it("إضافة بريد جديد ثم الإرسال ← يصل للمدير وللبريد الجديد معًا (مع إزالة التكرار)", async () => {
    await E.inject("POST", "/api/v1/email-recipients", { token: tok, body: { email: "new.person@example.com", name: "جديد" } });
    E.mail.sent.length = 0;
    const job = await waitJob((await send("wages", { extraRecipients: ["NEW.person@example.com", "AZ3919131@gmail.com", "one-off@x.com"] })).json.jobId);
    const to = job.perRecipient.map((x: any) => x.email);
    expect(new Set(to).size).toBe(to.length);
    expect(to).toEqual(expect.arrayContaining([ADMIN, "new.person@example.com", "one-off@x.com"]));
    expect(E.mail.to(ADMIN)).toHaveLength(1); expect(E.mail.to("new.person@example.com")).toHaveLength(1);
  });
  it("المستلمون المعطّلون لا يستلمون", async () => {
    const id = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json.items.find((x: any) => x.email === "a2@x.com").id;
    await E.inject("PATCH", `/api/v1/email-recipients/${id}`, { token: tok, body: { active: false } });
    E.mail.sent.length = 0;
    await waitJob((await send("recs", { attachXlsx: false })).json.jobId);
    expect(E.mail.to("a2@x.com")).toHaveLength(0);
  });
  it("نطاق التقارير: مستلم مستثنى من تقرير لا يصله، والمدير لا يُقيَّد", async () => {
    const items = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json.items;
    const c = items.find((x: any) => x.email === "consultant@example.com").id;
    expect((await E.inject("PUT", `/api/v1/email-recipients/${c}/scope`, { token: tok, body: { reportKey: "inv", allowed: false } })).status).toBe(200);
    E.mail.sent.length = 0;
    await waitJob((await send("inv")).json.jobId);
    expect(E.mail.to("consultant@example.com")).toHaveLength(0);
    expect(E.mail.to(ADMIN)).toHaveLength(1);
    await waitJob((await send("boq")).json.jobId);
    expect(E.mail.to("consultant@example.com")).toHaveLength(1);
  });
  it("تقرير الإحداثيات يُرفق KML إضافيًا وبه اسم المقاول", async () => {
    E.mail.sent.length = 0;
    await waitJob((await send("map", { attachXlsx: true })).json.jobId);
    const m = E.mail.to(ADMIN)[0];
    const names = m.attachments!.map((a) => a.filename);
    expect(names.some((n) => n.endsWith(".xlsx"))).toBe(true);
    const kml = m.attachments!.find((a) => a.filename.endsWith(".kml"))!;
    expect(kml.content.toString()).toContain("شركة ناصر مانع وبران وشركاه");
    expect(kml.content.toString()).toContain("Eng. Ahmed Zahran");
  });
  it("كل صفحة لها تقرير: ملخص 4–6 أرقام والتوقيع والتذييل", async () => {
    for (const key of ["dash", "firms", "master", "qty", "boq", "wages", "inv", "forms", "map", "recs", "deck"]) {
      E.mail.sent.length = 0;
      const job = await waitJob((await send(key)).json.jobId);
      expect(job.status, key).toBe("sent");
      const html = E.mail.to(ADMIN)[0].html;
      const rows = (html.match(/<tr><td/g) || []).length;
      expect(rows, key).toBeGreaterThanOrEqual(3); expect(rows, key).toBeLessThanOrEqual(6);
      expect(html, key).toContain("Eng. Ahmed Zahran");
    }
  });
  it("users/emails: لمدير النظام فقط ولا تُرسل لغيره أبدًا", async () => {
    const dept = (await E.login("salem", "Dept@12345")).token;
    const bad = await E.inject("POST", "/api/v1/reports/users/send", { token: dept, body: { lang: "ar" } });
    expect(bad.status).toBe(403);
    E.mail.sent.length = 0;
    const r = await E.inject("POST", "/api/v1/reports/users/send", { token: tok, body: { lang: "ar", attachPdf: false, attachXlsx: false, extraRecipients: ["leak@x.com"] } });
    const job = await waitJob(r.json.jobId);
    expect(job.perRecipient.map((x: any) => x.email)).toEqual([ADMIN]);
    expect(E.mail.to("leak@x.com")).toHaveLength(0);
  });
  it("حارس أمر العمل: لا يُرسل تقرير مشروع لمستخدم لا يملك صلاحية على مقاول المشروع", async () => {
    const c2 = (await E.inject("POST", "/api/v1/contractors", { token: tok, body: { name: "مقاول ثانٍ للعزل" } })).json;
    const cons = (await E.inject("GET", "/api/v1/contractors", { token: tok })).json;
    const first = cons.find((c: any) => c.id !== c2.id);
    const users = (await E.inject("GET", "/api/v1/users", { token: tok })).json;
    const pm = users.find((u: any) => u.username === "hamad");
    expect((await E.inject("PATCH", `/api/v1/users/${pm.id}`, { token: tok, body: { allContractors: false, contractorIds: [c2.id] } })).status).toBe(200);
    const pmTok = (await E.login("hamad", "Pm@12345")).token;
    const r = await E.inject("POST", "/api/v1/reports/boq/send", { token: pmTok, body: { workOrderId: projectId, lang: "ar", attachPdf: false, attachXlsx: false } });
    expect(r.status).toBe(403); expect(r.json.error.code).toBe("contractor_forbidden");
    expect((await E.inject("GET", "/api/v1/projects", { token: pmTok })).json).toHaveLength(0);     // عزل كامل
    expect((await E.inject("GET", `/api/v1/projects/${projectId}`, { token: pmTok })).status).toBe(403);
    await E.inject("PATCH", `/api/v1/users/${pm.id}`, { token: tok, body: { allContractors: true } });
    void first;
  });
  it("حد أقصى 50 مستلمًا للطلب", async () => {
    const extra = Array.from({ length: 50 }, (_, i) => `bulk${i}@x.com`);
    const r = await send("dash", { extraRecipients: extra });
    expect(r.status).toBe(400); expect(r.json.error.code).toBe("too_many_recipients");
  });
  it("إخفاق جزئي: حالة partial مع سبب لكل مستلم، ثم إعادة المحاولة للفاشل فقط", async () => {
    E.mail.failFor.add("one-off@x.com");
    E.mail.sent.length = 0;
    const r = await send("forms", { extraRecipients: ["one-off@x.com"] });
    await E.idle();
    let job = (await E.inject("GET", `/api/v1/reports/jobs/${r.json.jobId}`, { token: tok })).json;
    expect(["partial", "failed"]).toContain(job.status);
    const bad = job.perRecipient.find((x: any) => x.email === "one-off@x.com");
    expect(bad.status).toBe("failed"); expect(bad.error).toMatch(/550/);
    expect(job.perRecipient.find((x: any) => x.email === ADMIN).status).toBe("sent");
    expect(E.mail.to(ADMIN)).toHaveLength(1);
    E.mail.failFor.delete("one-off@x.com");
    await E.h.pool.query("update email_log set status='failed', attempts=3 where id=$1", [r.json.jobId]);
    const retry = await E.inject("POST", `/api/v1/email-log/${r.json.jobId}/retry`, { token: tok });
    expect(retry.status).toBe(202);
    await E.idle();
    job = (await E.inject("GET", `/api/v1/reports/jobs/${r.json.jobId}`, { token: tok })).json;
    expect(job.status).toBe("sent");
    expect(E.mail.to(ADMIN)).toHaveLength(1);       // لم يُعَد الإرسال لمن نجح
    expect(E.mail.to("one-off@x.com")).toHaveLength(1);
  });
  it("المرفقات الكبيرة تتحول إلى رابط تنزيل موقّع صالح 7 أيام", async () => {
    const big = await createTestEnv({ REPORT_MAX_ATTACH_MB: "0.0001" } as never);
    try {
      const t = await big.unlockedToken();
      const pid = (await big.inject("GET", "/api/v1/projects", { token: t })).json[0].id;
      const r = await big.inject("POST", "/api/v1/reports/boq/send", { token: t, body: { workOrderId: pid, lang: "ar", attachPdf: false, attachXlsx: true } });
      await big.idle();
      const job = (await big.inject("GET", `/api/v1/reports/jobs/${r.json.jobId}`, { token: t })).json;
      expect(job.attachments[0].mode).toBe("link");
      const m = big.mail.to(ADMIN)[0];
      expect(m.attachments).toHaveLength(0);
      const url = /href="([^"]*\/api\/v1\/downloads\/[^"]+)"/.exec(m.html)![1];
      expect(m.html).toContain("7 أيام");
      const dl = await big.inject("GET", url.replace(/^https?:\/\/[^/]+/, ""));
      expect(dl.status).toBe(200); expect(dl.headers["content-type"]).toContain("spreadsheetml");
      expect((await big.inject("GET", "/api/v1/downloads/" + "x".repeat(40))).status).toBe(410);
    } finally { await big.close(); }
  });
  it("رسالة اختبار لمستلم وللكل + حالة المزوّد", async () => {
    const items = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json.items;
    E.mail.sent.length = 0;
    const one = await E.inject("POST", `/api/v1/email-recipients/${items.find((x: any) => x.email === "a1@x.com").id}/test`, { token: tok });
    expect(one.status).toBe(202); await E.idle();
    expect(E.mail.sent).toHaveLength(1); expect(E.mail.sent[0].to).toEqual(["a1@x.com"]);
    E.mail.sent.length = 0;
    await E.inject("POST", "/api/v1/email-recipients/test-all", { token: tok }); await E.idle();
    expect(E.mail.to(ADMIN)).toHaveLength(1);
    expect((await E.inject("GET", "/api/v1/mail/health", { token: tok })).json).toMatchObject({ ok: true, provider: "fake" });
    E.mail.healthy = false;
    expect((await E.inject("GET", "/api/v1/mail/health", { token: tok })).json.ok).toBe(false);
  });
  it("سجل الإرسال والبطاقات", async () => {
    const log = (await E.inject("GET", "/api/v1/email-log?limit=100", { token: tok })).json;
    expect(log.length).toBeGreaterThan(10);
    expect(log[0]).toHaveProperty("recipients"); expect(log[0]).toHaveProperty("status");
    const s = (await E.inject("GET", "/api/v1/email-recipients", { token: tok })).json.summary;
    expect(s.total).toBeGreaterThan(3); expect(s.successRate30d).toBeGreaterThan(0);
  });
});
