import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createTestEnv, multipart, type TestEnv } from "./helpers";

let E: TestEnv, tok: string, P: any, contractorId: string;
beforeAll(async () => {
  E = await createTestEnv();
  tok = await E.unlockedToken();
  P = (await E.inject("GET", "/api/v1/projects", { token: tok })).json[0];
  contractorId = P.contractorId;
});
afterAll(async () => { await E.close(); });

async function xlsx(rows: unknown[][], name = "Sheet1"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(name);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
}
const upload = (id: string, files: { name: string; data: Buffer }[], fields: Record<string, string> = {}, token = tok) => {
  const m = multipart(files, fields);
  return E.app.inject({ method: "POST", url: `/api/v1/projects/${id}/files`, headers: { authorization: "Bearer " + token, ...m.headers }, payload: m.payload }).then((r) => ({ status: r.statusCode, json: JSON.parse(r.body) }));
};

describe("مشروع الحصينية المزروع", () => {
  it("بياناته كاملة وأرقامه مطابقة للمنصة الحالية", () => {
    expect(P).toMatchObject({ name: "مشروع تحويل طريق الحصينية", wo: "234022308", site: "طريق الحصينية – نجران" });
    expect(P.sheets).toHaveLength(4); expect(P.rmus).toHaveLength(29);
    expect(P.derived.cost.total).toBeCloseTo(10381209.473049998, 4);
    expect(P.derived.cost.mat).toBeCloseTo(6060521.63, 2);
    expect(P.estCost).toEqual({ mat: 3988328.9, inst: 2107546.56, ind: 1418591.53 });
    expect(P.boq["304010202"]).toEqual({ plan: 18000, exec: 17430 });
    expect(P.files).toEqual([]);
  });
  it("PUT: تعديل حصر اللوحات يُبطل الاستنباط، وعامل جديد يعيد الاشتقاق", async () => {
    const sheets = JSON.parse(JSON.stringify(P.sheets)); sheets[0].htCable = 5000;
    let r = await E.inject("PUT", `/api/v1/projects/${P.id}`, { token: tok, body: { sheets, derived: false } });
    expect(r.status).toBe(200); expect(r.json.derived).toBeNull();
    r = await E.inject("PUT", `/api/v1/projects/${P.id}`, { token: tok, body: { derived: true } });
    expect(r.json.derived.works["304010202"]).toBe(18180);
    sheets[0].htCable = 4820;
    r = await E.inject("PUT", `/api/v1/projects/${P.id}`, { token: tok, body: { sheets, factors: { wastePct: 2 } } });
    expect(r.json.derived.cost.total).toBeCloseTo(10381209.473049998, 4);
  });
  it("قفل الإصدار: تعديل بنسخة قديمة 409", async () => {
    const cur = (await E.inject("GET", `/api/v1/projects/${P.id}`, { token: tok })).json;
    const r = await E.inject("PUT", `/api/v1/projects/${P.id}`, { token: tok, body: { notes: "x", expectedVersion: cur.version - 1 } });
    expect(r.status).toBe(409);
  });
});

describe("رفع الملفات والاستيراد وحارس الهوية", () => {
  it("ملف ضبط حماية بنفس أمر العمل ← يُستورد ويطابق الوحدات", async () => {
    const f = await xlsx([
      ["ضبط الحماية — أمر العمل 234022308"],
      ["Feeder", "RMU No", "Equipment Type", "Setting Completed", "Ground Ohm", "Latitude", "Longitude"],
      ["NER 409", "R101552", "RMU 4W", "Yes", 2.5, 17.693713, 44.459428],
      ["NER 409", "R101553", "RMU 4W", "Yes", 2.9, 17.69372, 44.45943],
      ["NER 409", "R101554", "RMU 3W", "Yes", 3.2, 17.697286, 44.456931],
    ], "protection");
    const r = await upload(P.id, [{ name: "protection-234022308.xlsx", data: f }]);
    expect(r.status).toBe(200);
    expect(r.json.files).toHaveLength(1);
    expect(r.json.files[0]).toMatchObject({ imported: true, blocked: false, woState: "match" });
    expect(r.json.files[0].storageKey).toBeUndefined();               // لا تسريب لمفاتيح التخزين
    expect(r.json.report.some(([k, m]: [string, string]) => k === "ok" && m.includes("جدول الوحدات"))).toBe(true);
    expect(r.json.rmus.find((u: any) => u.rmu === "R101552")).toMatchObject({ set: true, ohm: "2.5" });
    expect(r.json.rmus).toHaveLength(29);
    expect(r.json.canUndo).toBe(true);
  });
  it("ملف بأمر عمل مختلف ← يُوقف ولا يُستورد (حارس عدم الخلط) ثم «استورد رغم الاختلاف»", async () => {
    const before = (await E.inject("GET", `/api/v1/projects/${P.id}`, { token: tok })).json;
    const f = await xlsx([
      ["أمر العمل", "234011111", "اسم المشروع", "مشروع آخر في شرورة"],
      ["Feeder", "RMU No", "Equipment Type", "Setting Completed", "Ground Ohm"],
      ["X", "R200001", "RMU 4W", "Yes", 1.1], ["X", "R200002", "RMU 4W", "Yes", 1.2], ["X", "R200003", "RMU 3W", "Yes", 1.3],
    ], "other");
    const r = await upload(P.id, [{ name: "other-project.xlsx", data: f }]);
    expect(r.status).toBe(200); expect(r.json.blocked).toBe(1);
    const rec = r.json.files.find((x: any) => x.name === "other-project.xlsx");
    expect(rec).toMatchObject({ blocked: true, imported: false, woState: "mismatch" });
    expect(r.json.rmus).toHaveLength(before.rmus.length);                  // لم تدخل وحدات الملف الآخر
    expect(r.json.rmus.some((u: any) => u.rmu === "R200001")).toBe(false);
    expect(r.json.report.some(([k]: [string]) => k === "warn")).toBe(true);
    const force = await E.inject("POST", `/api/v1/projects/${P.id}/files/${rec.id}/force`, { token: tok, body: {} });
    expect(force.status).toBe(200);
    expect(force.json.rmus.some((u: any) => u.rmu === "R200001")).toBe(true);
    expect(force.json.files.find((x: any) => x.id === rec.id)).toMatchObject({ blocked: false, imported: true });
  });
  it("طلب UDS فرعي يُعامل كطلب مرتبط لا كتعارض", async () => {
    const f = await xlsx([["رقم الطلب", "234099001", "اسم المشروع", "ثقب أفقي طريق الحصينية"], ["x"], ["y"], ["z"], ["w"]], "uds");
    const r = await upload(P.id, [{ name: "hdd-request.xlsx", data: f }]);
    expect(r.json.files.find((x: any) => x.name === "hdd-request.xlsx")).toMatchObject({ blocked: false, woState: "related" });
  });
  it("«اعتمد هذا الرقم» يغيّر أمر العمل للمشروع", async () => {
    const r = await E.inject("POST", `/api/v1/projects/${P.id}/adopt-wo`, { token: tok, body: { wo: "234011111" } });
    expect(r.json.wo).toBe("234011111");
    await E.inject("POST", `/api/v1/projects/${P.id}/adopt-wo`, { token: tok, body: { wo: "234022308" } });
  });
  it("تراجع عن آخر استيراد يعيد الحالة ويحذف الملفات المرفوعة بعده", async () => {
    const cur = (await E.inject("GET", `/api/v1/projects/${P.id}`, { token: tok })).json;
    const f = await xlsx([["x", "y"], [1, 2]]);
    await upload(P.id, [{ name: "dummy.xlsx", data: f }]);
    const u = await E.inject("POST", `/api/v1/projects/${P.id}/undo`, { token: tok });
    expect(u.status).toBe(200);
    expect(u.json.files.length).toBe(cur.files.length);
    expect(u.json.files.some((x: any) => x.name === "dummy.xlsx")).toBe(false);
  });
  it("عرض أصل الملف + مسح الملفات المرفوعة", async () => {
    const cur = (await E.inject("GET", `/api/v1/projects/${P.id}`, { token: tok })).json;
    const id = cur.files[0].id;
    const o = await E.app.inject({ method: "GET", url: `/api/v1/projects/${P.id}/files/${id}/original`, headers: { authorization: "Bearer " + tok } });
    expect(o.statusCode).toBe(200); expect(o.rawPayload.length).toBeGreaterThan(1000);
    expect(o.headers["content-security-policy"]).toBe("sandbox");
    const s = await E.inject("GET", `/api/v1/projects/${P.id}/files/${id}/sheets`, { token: tok });
    expect(s.json.sheets[0].rows.length).toBeGreaterThan(2);
    const c = await E.inject("POST", `/api/v1/projects/${P.id}/files/clear`, { token: tok, body: { wipeData: false } });
    expect(c.json.files).toEqual([]); expect(c.json.cleared).toBeGreaterThan(0);
  });
  it("استيراد قسم مستقل (المقايسة) من إكسل", async () => {
    const f = await xlsx([["البند", "الوصف", "المخطط", "المنفذ"], ["301010201", "حفر", 100, 80], ["301010205", "حفر", 100, 90], ["304010202", "تمديد", 100, 95], ["311000016", "VLF", 1, 1], ["305020104", "وصلة", 1, 1]]);
    const m = multipart([{ name: "boq.xlsx", data: f }]);
    const r = await E.app.inject({ method: "POST", url: `/api/v1/projects/${P.id}/import/boq`, headers: { authorization: "Bearer " + tok, ...m.headers }, payload: m.payload });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).boq["301010201"]).toEqual({ plan: 100, exec: 80 });
  });
});

describe("التصدير", () => {
  it("XLSX/KML/DXF/CSV/GeoJSON/SVG من الخادم بتوقيع مدير المشاريع", async () => {
    const get = (k: string) => E.app.inject({ method: "GET", url: `/api/v1/projects/${P.id}/export/${k}`, headers: { authorization: "Bearer " + tok } });
    for (const [k, ct] of [["xlsx", "spreadsheetml"], ["invoice", "spreadsheetml"], ["tally", "spreadsheetml"], ["kml", "google-earth"], ["dxf", "dxf"], ["csv", "text/csv"], ["geojson", "geo+json"], ["svg", "svg"]] as const) {
      const r = await get(k);
      expect(r.statusCode, k).toBe(200); expect(r.headers["content-type"], k).toContain(ct);
    }
    expect((await get("kml")).body).toContain("Eng. Ahmed Zahran");
    expect((await get("csv")).body).toContain("Eng. Ahmed Zahran");
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load((await get("xlsx")).rawPayload as unknown as ArrayBuffer);
    expect(wb.worksheets).toHaveLength(6);
  });
  it("تجميع Google Earth لكل المشاريع (KML بمجلد لكل أمر عمل)", async () => {
    const r = await E.app.inject({ method: "GET", url: "/api/v1/portfolio/export/kml", headers: { authorization: "Bearer " + tok } });
    expect(r.statusCode).toBe(200); expect(r.body).toContain("<Folder>"); expect(r.body).toContain("أمر عمل 234022308");
  });
});

describe("المقاولون والعزل", () => {
  it("مقاولون ومشاريع: إضافة ونقل وحذف مع نقل المشاريع", async () => {
    const c = (await E.inject("POST", "/api/v1/contractors", { token: tok, body: { name: "مقاول اختبار النقل" } })).json;
    const np = (await E.inject("POST", "/api/v1/projects", { token: tok, body: { name: "مشروع جديد", wo: "234055555", contractorId: c.id } })).json;
    expect(np.contractorId).toBe(c.id);
    expect((await E.inject("POST", `/api/v1/projects/${np.id}/move`, { token: tok, body: { contractorId } })).json.contractorId).toBe(contractorId);
    const d = await E.inject("DELETE", `/api/v1/contractors/${c.id}`, { token: tok });
    expect(d.json.ok).toBe(true);
    const dup = await E.inject("POST", "/api/v1/contractors", { token: tok, body: { name: "شركة ناصر مانع وبران وشركاه" } });
    expect(dup.status).toBe(409);
  });
  it("نسخ مشروع", async () => {
    const cur = (await E.inject("GET", `/api/v1/projects/${P.id}`, { token: tok })).json;
    const r = await E.inject("POST", "/api/v1/projects", { token: tok, body: { name: "نسخة", wo: "", contractorId, copyFromId: P.id } });
    expect(r.status).toBe(201); expect(r.json.rmus).toHaveLength(cur.rmus.length); expect(r.json.id).not.toBe(P.id); expect(r.json.files).toEqual([]);
  });
});
