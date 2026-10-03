import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import ExcelJS from "exceljs";
import { createErpAdapter } from "../src/services/erp";
import { createTestEnv, multipart, type TestEnv } from "./helpers";

let E: TestEnv, tok: string, projectId: string;
beforeAll(async () => {
  E = await createTestEnv();
  tok = await E.unlockedToken();
  projectId = (await E.inject("GET", "/api/v1/projects", { token: tok })).json[0].id;
});
afterAll(async () => { await E.close(); });

const mkKey = async (scopes: string[], name = "n8n") => (await E.inject("POST", "/api/v1/api-keys", { token: tok, body: { name, scopes } })).json;
const asKey = (key: string, method: string, url: string, body?: unknown) => E.inject(method, url, { headers: { "x-api-key": key }, body });

describe("مفاتيح API", () => {
  it("المفتاح يظهر مرة واحدة ويُحفظ مجزّأً، وصلاحياته بالنطاق فقط", async () => {
    const k = await mkKey(["read:projects"]);
    expect(k.key).toMatch(/^ilt_/);
    const list = (await E.inject("GET", "/api/v1/api-keys", { token: tok })).json;
    expect(JSON.stringify(list)).not.toContain(k.key);
    // قراءة المشاريع مسموحة بالنطاق read:projects (يستعملها n8n)
    const ok = await asKey(k.key, "GET", "/api/v1/projects");
    expect(ok.status).toBe(200); expect(ok.json.length).toBeGreaterThan(0);
    // لكن بلا النطاق send:reports لا إرسال
    const no = await asKey(k.key, "POST", "/api/v1/reports/dash/send", { workOrderId: projectId });
    expect(no.status).toBe(403); expect(no.json.error.code).toBe("scope_missing");
    // مفتاح خاطئ
    expect((await asKey("ilt_wrong", "GET", "/api/v1/projects")).status).toBe(401);
  });
  it("إلغاء المفتاح يوقفه فورًا", async () => {
    const k = await mkKey(["read:projects"], "temp");
    expect((await asKey(k.key, "GET", "/api/v1/projects")).status).toBe(200);
    await E.inject("DELETE", `/api/v1/api-keys/${k.id}`, { token: tok });
    expect((await asKey(k.key, "GET", "/api/v1/projects")).status).toBe(401);
  });
  it("إرسال تقرير بمفتاح send:reports يصل لمدير النظام دائمًا", async () => {
    const k = await mkKey(["send:reports"], "weekly");
    E.mail.sent.length = 0;
    const r = await asKey(k.key, "POST", "/api/v1/reports/dash/send", { workOrderId: projectId, lang: "ar", attachPdf: false, attachXlsx: true });
    expect(r.status).toBe(202);
    await E.idle();
    expect(E.mail.to("az3919131@gmail.com").length).toBe(1);
    const job = await asKey(k.key, "GET", `/api/v1/reports/jobs/${r.json.jobId}`);
    expect(job.json.status).toBe("sent");
  });
  it("المفاتيح لا تدير المفاتيح: إنشاء مفتاح يحتاج مستخدمًا بصلاحية users", async () => {
    const k = await mkKey(["read:projects", "write:imports", "send:reports"], "all");
    const r = await asKey(k.key, "POST", "/api/v1/api-keys", { name: "xyz", scopes: ["read:projects"] });
    expect(r.status).toBe(401);
  });
});

describe("Webhooks الصادرة", () => {
  it("حدث project.created يصل موقّعًا بـ HMAC-SHA256 قابلًا للتحقق", async () => {
    const got: { sig: string; ev: string; body: string }[] = [];
    const srv = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => { got.push({ sig: String(req.headers["x-signature"]), ev: String(req.headers["x-event"]), body: Buffer.concat(chunks).toString() }); res.writeHead(200).end("ok"); });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/hook`;
    try {
      const wh = (await E.inject("POST", "/api/v1/webhooks", { token: tok, body: { url, events: ["project.created", "import.completed"] } })).json;
      expect(wh.secret).toMatch(/^whsec_/);
      const cid = (await E.inject("GET", "/api/v1/contractors", { token: tok })).json[0].id;
      await E.inject("POST", "/api/v1/projects", { token: tok, body: { name: "مشروع ويب هوك", wo: "234099777", contractorId: cid } });
      await E.idle();
      for (let i = 0; i < 40 && !got.length; i++) await new Promise((r) => setTimeout(r, 50));
      expect(got.length).toBe(1);
      expect(got[0].ev).toBe("project.created");
      const expect_ = "sha256=" + createHmac("sha256", wh.secret).update(got[0].body).digest("hex");
      expect(got[0].sig).toBe(expect_);
      expect(JSON.parse(got[0].body).data).toMatchObject({ name: "مشروع ويب هوك", wo: "234099777" });
      // اختبار ping
      const t = await E.inject("POST", `/api/v1/webhooks/${wh.id}/test`, { token: tok });
      expect(t.json.status).toBe("delivered");
    } finally { await new Promise((r) => srv.close(r)); }
  });
});

describe("Webhook الوارد /hooks/import", () => {
  const xlsx = async (rows: unknown[][]) => { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("S"); rows.forEach((r) => ws.addRow(r)); return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer); };
  it("يستورد ملفًا عبر نفس المحرك بمفتاح write:imports أو بالسر المشترك، ويرفض بلا مصادقة", async () => {
    const data = await xlsx([["البند", "الوصف", "المخطط", "المنفذ"], ["301010201", "حفر", 10, 8], ["301010205", "حفر", 10, 9], ["304010202", "تمديد", 10, 9], ["311000016", "VLF", 1, 1], ["305020104", "وصلة", 1, 1]]);
    const m = multipart([{ name: "boq.xlsx", data }]);
    const none = await E.inject("POST", "/api/v1/hooks/import?wo=234022308", { headers: m.headers, body: m.payload as any });
    expect(none.status).toBe(401);
    const bySecret = await E.inject("POST", "/api/v1/hooks/import?wo=234022308", { headers: { ...m.headers, "x-webhook-secret": E.cfg.WEBHOOK_SECRET }, body: m.payload as any });
    expect(bySecret.status).toBe(200);
    expect(bySecret.json.files.some((f: any) => f.name === "boq.xlsx")).toBe(true);
    const k = await mkKey(["write:imports"], "importer");
    const byKey = await E.inject("POST", `/api/v1/hooks/import?workOrderId=${projectId}`, { headers: { ...m.headers, "x-api-key": k.key }, body: m.payload as any });
    expect(byKey.status).toBe(200);
  });
});

describe("ErpAdapter", () => {
  it("التنفيذ الافتراضي وهمي: لا يتصل بأي نظام ويقبل المستخلص", async () => {
    const erp = createErpAdapter();
    expect(erp.name).toBe("mock");
    expect(await erp.fetchMaterialMovements("234022308")).toEqual([]);
    expect(await erp.pushInvoice({ workOrder: "234022308", invoiceNo: "7", contractor: "c", grossAmount: 1, netPayable: 1, currency: "SAR", lines: [] })).toEqual({ accepted: true, reference: "MOCK-7" });
  });
});
