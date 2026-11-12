import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearKey, DashboardError, fetchOverview, loadSession, normalizeMessage, normalizeReply, saveDailyMessage, saveSession } from "../src/lib/dashboardApi";
import { computeStats, newestFirst, perDay, riyadhDate } from "../src/lib/stats";
import { filterReplies } from "../src/dashboard/ReplyLog";
import { demoOverview } from "../src/dashboard/demo";
import { fillTemplate, niceMax, shortDay } from "../src/lib/format";
import { parseRoute } from "../src/lib/useRoute";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const session = { url: "https://n8n.io/webhook/ahmed-dashboard", key: "k" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("عميل لوحة التحكم", () => {
  it("يطبّع صف الجدول (أسماء الأعمدة في n8n) ويفهم «نعم/لا»", () => {
    expect(normalizeMessage({ message: "م", enabled: "نعم", updated_on: "2026-10-01" })).toEqual({ message: "م", enabled: true, updatedOn: "2026-10-01" });
    expect(normalizeMessage({ message: "م", enabled: "لا" })?.enabled).toBe(false);
    expect(normalizeMessage(null)).toBeNull();
    expect(normalizeReply({ id: 7, phone: "9665", incoming_text: "هاي", reply_date: "2026-10-01", reply_text: "أهلا", createdAt: "x" }, 0)).toMatchObject({ id: "7", incomingText: "هاي", replyDate: "2026-10-01", replyText: "أهلا" });
  });

  it("fetchOverview يرسل المفتاح في الترويسة والإجراء في الجسم", async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, message: { message: "x", enabled: "نعم" }, replies: [{ id: 1, phone: "1", reply_date: "2026-10-01" }] }));
    const ov = await fetchOverview(session, f);
    expect(ov.replies).toHaveLength(1);
    expect(ov.message?.enabled).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(session.url);
    expect(init.headers["x-dashboard-key"]).toBe("k");
    expect(JSON.parse(init.body)).toEqual({ action: "overview" });
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [500, "server"],
  ])("الحالة %i ← %s", async (status, code) => {
    const f = vi.fn().mockResolvedValue(json({ ok: false }, status));
    await expect(fetchOverview(session, f)).rejects.toMatchObject({ code });
  });

  it("خطأ الشبكة وصيغة الرد الخاطئة ورابط غير مضبوط", async () => {
    await expect(fetchOverview(session, vi.fn().mockRejectedValue(new TypeError("x")))).rejects.toMatchObject({ code: "network" });
    await expect(fetchOverview(session, vi.fn().mockResolvedValue(json({ hello: 1 })))).rejects.toMatchObject({ code: "bad-response" });
    await expect(fetchOverview(session, vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })))).rejects.toBeInstanceOf(DashboardError);
    await expect(fetchOverview({ url: "", key: "k" })).rejects.toMatchObject({ code: "not-configured" });
  });

  it("saveDailyMessage يكتب «نعم/لا» كما يتوقعها نموذج n8n الحالي", async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, message: { message: "جديد", enabled: "لا", updated_on: "2026-10-11" } }));
    const msg = await saveDailyMessage(session, { message: "جديد", enabled: false }, f);
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ action: "save_message", message: "جديد", enabled: "لا" });
    expect(msg).toEqual({ message: "جديد", enabled: false, updatedOn: "2026-10-11" });
  });

  it("المفتاح يبقى في الجلسة افتراضيًا ولا يُحفظ على الجهاز إلا بطلب المستخدم", () => {
    saveSession({ url: "https://x.io/h", key: "secret", remember: false });
    expect(localStorage.getItem("nm.dash.key")).toBeNull();
    expect(sessionStorage.getItem("nm.dash.key")).toBe("secret");
    expect(loadSession()).toMatchObject({ url: "https://x.io/h", key: "secret", remember: false });
    saveSession({ url: "https://x.io/h", key: "secret", remember: true });
    expect(localStorage.getItem("nm.dash.key")).toBe("secret");
    expect(sessionStorage.getItem("nm.dash.key")).toBeNull();
    clearKey();
    expect(loadSession().key).toBe("");
  });
});

describe("الإحصاءات", () => {
  const rep = (replyDate: string, phone = "1", extra = {}) => ({ id: replyDate + phone, createdAt: "", phone, name: "", incomingText: "هاي", replyDate, replyText: "أهلا", ...extra });

  it("perDay يرجع 14 يومًا متصلة بالأقدم أولًا ويملأ الأيام الفارغة بصفر", () => {
    const s = perDay([rep("2026-10-11"), rep("2026-10-11", "2"), rep("2026-10-09")], "2026-10-11", 14);
    expect(s).toHaveLength(14);
    expect(s[0]!.date).toBe("2026-09-28");
    expect(s[13]).toEqual({ date: "2026-10-11", count: 2 });
    expect(s[12]!.count).toBe(0);
    expect(s[11]!.count).toBe(1);
  });

  it("computeStats: اليوم والإجمالي والجهات الفريدة وآخر 7 أيام", () => {
    const rows = [rep("2026-10-11", "1"), rep("2026-10-11", "2"), rep("2026-10-08", "1"), rep("2026-09-01", "3")];
    const st = computeStats(rows, "2026-10-11");
    expect(st).toMatchObject({ today: 2, total: 4, contacts: 3, last7: 3 });
    expect(st.latest?.replyDate).toBe("2026-10-11");
  });

  it("riyadhDate يحسب اليوم بتوقيت الرياض (UTC+3)", () => {
    expect(riyadhDate(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-12");
    expect(riyadhDate(new Date("2026-10-11T20:30:00Z"))).toBe("2026-10-11");
  });

  it("الفلترة بالنص والفترة، وأحدث أولًا", () => {
    const rows = [rep("2026-10-11", "111", { name: "خالد", incomingText: "عرض سعر" }), rep("2026-10-05", "222", { name: "Omar" }), rep("2026-08-01", "333")];
    expect(filterReplies(rows, "خالد", "all", "2026-10-11")).toHaveLength(1);
    expect(filterReplies(rows, "omar", "all", "2026-10-11")).toHaveLength(1);
    expect(filterReplies(rows, "", "today", "2026-10-11")).toHaveLength(1);
    expect(filterReplies(rows, "", "7", "2026-10-11")).toHaveLength(2);
    expect(filterReplies(rows, "333", "all", "2026-10-11")).toHaveLength(1);
    expect(newestFirst(rows).map((r) => r.phone)).toEqual(["111", "222", "333"]);
  });

  it("البيانات التجريبية تولّد ردودًا بأرقام وهمية فقط", () => {
    const ov = demoOverview(new Date("2026-10-11T10:00:00Z"));
    expect(ov.replies.length).toBeGreaterThan(10);
    expect(ov.replies.every((r) => r.phone.startsWith("96650000"))).toBe(true);
    expect(ov.message?.message).toContain("Project manager · Eng. Ahmed Zahran");
  });
});

describe("أدوات مساعدة", () => {
  it("niceMax يعطي سقفًا نظيفًا", () => {
    expect([0, 3, 5, 7, 9, 12, 41, 130].map(niceMax)).toEqual([4, 4, 6, 8, 10, 20, 60, 200]);
    // نصف السقف عدد صحيح دائمًا (علامات المحور أعداد ردود)
    for (const n of [0, 1, 5, 9, 13, 27, 55, 99, 310]) expect(Number.isInteger(niceMax(n) / 2)).toBe(true);
  });
  it("shortDay يعطي d/M بلا أصفار", () => expect(shortDay("2026-09-03")).toBe("3/9"));
  it("fillTemplate يستبدل {name} و{date} كلها", () => {
    expect(fillTemplate("أهلا {name} — {date} — {name}", { name: "خالد", date: "2026-10-11" })).toBe("أهلا خالد — 2026-10-11 — خالد");
  });
  it("التوجيه: الرئيسية واللوحة وغير المعروف، وروابط الأقسام تبقى في الرئيسية", () => {
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("#about")).toEqual({ name: "home" });
    expect(parseRoute("#/")).toEqual({ name: "home" });
    expect(parseRoute("#/dashboard")).toEqual({ name: "dashboard" });
    expect(parseRoute("#/dashboard/")).toEqual({ name: "dashboard" });
    expect(parseRoute("#/x")).toEqual({ name: "not-found" });
  });
});

import { n8nLinks } from "../src/lib/n8nLinks";
describe("روابط n8n المباشرة", () => {
  it("تُبنى من عنوان الخادم وتتجاهل الشرطة الأخيرة", () => {
    const l = n8nLinks("https://n8n.example.com//");
    expect(l?.dashboardWorkflow).toBe("https://n8n.example.com/workflow/CkNNYICjLShIs9k7");
    expect(l?.autoReplyWorkflow).toBe("https://n8n.example.com/workflow/A3nq2aTBFgpF4JCq");
    expect(l?.credentials).toBe("https://n8n.example.com/home/credentials");
    expect(l?.dataTables).toBe("https://n8n.example.com/projects/NXiVEPvIE28h3Eku/datatables");
  });
  it("بلا عنوان خادم لا روابط", () => expect(n8nLinks("  ")).toBeNull());
});
