import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { loadConfig } from "../src/config";
import { GmailApiProvider, ResendProvider, createMailProvider } from "../src/services/mail";
import type { MailMessage } from "../src/services/types";

/**
 * مزوّدا Resend وGmail API بلا مفاتيح حية: نعترض fetch ونتحقق من شكل الطلب الفعلي (العنوان والترويسات والجسم)
 * ومن معالجة الأخطاء. هذا لا يغني عن تجربة حية، لكنه يثبت أن ما نرسله مطابق لعقد الواجهتين.
 */
const cfg = (over: Record<string, string> = {}) => loadConfig({
  NODE_ENV: "test", DATABASE_URL: "postgresql://x/x", JWT_SECRET: "test-secret-123456", WEBHOOK_SECRET: "wh-test",
  ADMIN_EMAIL: "az3919131@gmail.com", MAIL_FROM: "محفظة الالتزام <reports@example.com>", ...over,
} as NodeJS.ProcessEnv);

const PDF = randomBytes(3000);
const msg = (over: Partial<MailMessage> = {}): MailMessage => ({
  to: ["az3919131@gmail.com", "Other@Example.com", "az3919131@gmail.com"],
  subject: "[محفظة الالتزام] لوحة المتابعة — مشروع تجريبي — W/O 123",
  html: "<p dir=\"rtl\">نص الرسالة</p>", text: "نص الرسالة",
  attachments: [{ filename: "report.pdf", content: PDF, contentType: "application/pdf" }], ...over,
});

interface Call { url: string; init: RequestInit & { headers: Record<string, string> } }
let calls: Call[];
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (handler: (c: Call) => Response) => vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => { const c = { url: String(url), init: { ...init, headers: init?.headers ?? {} } }; calls.push(c); return handler(c); }));
beforeEach(() => { calls = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("اختيار المزوّد", () => {
  it("MAIL_PROVIDER يحدد الصنف (والافتراضي smtp)", () => {
    expect(createMailProvider(cfg()).name).toBe("smtp");
    expect(createMailProvider(cfg({ MAIL_PROVIDER: "resend" })).name).toBe("resend");
    expect(createMailProvider(cfg({ MAIL_PROVIDER: "gmail_api" })).name).toBe("gmail_api");
  });
});

describe("Resend", () => {
  const p = () => new ResendProvider(cfg({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_SECRET_KEY_123" }));

  it("يرسل POST إلى /emails بمفتاح Bearer وجسم JSON صحيح (مستلمون بلا تكرار، مرفق base64)", async () => {
    stub(() => reply(200, { id: "re_msg_1" }));
    const r = await p().send(msg());
    expect(r).toEqual({ ok: true, messageId: "re_msg_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe("Bearer re_SECRET_KEY_123");
    const b = JSON.parse(calls[0].init.body as string);
    expect(b.from).toBe("محفظة الالتزام <reports@example.com>");
    expect(b.to).toEqual(["az3919131@gmail.com", "Other@Example.com"]);
    expect(b.subject).toContain("W/O 123");
    expect(b.html).toContain("نص الرسالة");
    expect(b.attachments).toEqual([{ filename: "report.pdf", content: PDF.toString("base64") }]);
  });

  it("فشل الواجهة يعيد خطأ مقروءًا بلا تسريب المفتاح", async () => {
    stub(() => reply(403, { message: "The domain is not verified" }));
    const r = await p().send(msg());
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Resend 403: The domain is not verified");
    expect(r.error).not.toContain("re_SECRET_KEY_123");
  });

  it("انقطاع الشبكة لا يرمي استثناءً بل يعيد ok:false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connect ECONNREFUSED"); }));
    expect(await p().send(msg())).toEqual({ ok: false, error: "connect ECONNREFUSED" });
  });

  it("بلا RESEND_API_KEY: لا طلب شبكة", async () => {
    stub(() => reply(200, {}));
    const r = await new ResendProvider(cfg({ MAIL_PROVIDER: "resend" })).send(msg());
    expect(r).toEqual({ ok: false, error: "RESEND_API_KEY غير مضبوط" });
    expect(calls).toHaveLength(0);
  });

  it("health: 200 سليم، 401 مفتاح مرفوض", async () => {
    stub(() => reply(200, { data: [] }));
    expect((await p().health()).ok).toBe(true);
    stub(() => reply(401, { message: "API key is invalid" }));
    expect((await p().health()).ok).toBe(false);
  });
});

/** يفكّ رأس Subject المشفّر بـ RFC 2047 (قد يتجزأ إلى عدة كلمات مشفّرة) */
const decodeHeader = (mime: string, name: string): string => {
  const m = new RegExp(`^${name}:\\s*((?:.+(?:\\r?\\n[ \\t].+)*))`, "mi").exec(mime);
  if (!m) return "";
  const v = m[1].replace(/\r?\n[ \t]+/g, " ");
  return v.replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=\s*/gi, (_s, enc: string, txt: string) =>
    enc.toUpperCase() === "B" ? Buffer.from(txt, "base64").toString("utf8") : Buffer.from(txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"));
};

describe("Gmail API", () => {
  const gcfg = () => cfg({ MAIL_PROVIDER: "gmail_api", GMAIL_CLIENT_ID: "cid.apps.googleusercontent.com", GMAIL_CLIENT_SECRET: "csecret-XYZ", GMAIL_REFRESH_TOKEN: "1//refresh-TOKEN", GMAIL_SENDER: "sender@example.com" });
  const route = (c: Call) => c.url.startsWith("https://oauth2.googleapis.com/token")
    ? reply(200, { access_token: "ya29.ACCESS", expires_in: 3599 }) : reply(200, { id: "gm_1", threadId: "t_1" });

  it("يستبدل refresh token بـ access token ثم يرسل MIME base64url إلى users.messages.send", async () => {
    stub(route);
    const r = await new GmailApiProvider(gcfg()).send(msg());
    expect(r).toEqual({ ok: true, messageId: "gm_1" });
    expect(calls).toHaveLength(2);

    const [tok, snd] = calls;
    expect(tok.url).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(tok.init.body as string);
    expect(Object.fromEntries(form)).toEqual({ client_id: "cid.apps.googleusercontent.com", client_secret: "csecret-XYZ", refresh_token: "1//refresh-TOKEN", grant_type: "refresh_token" });

    expect(snd.url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(snd.init.headers.Authorization).toBe("Bearer ya29.ACCESS");
    const { raw } = JSON.parse(snd.init.body as string);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);                       // base64url بلا + / =
    const mime = Buffer.from(raw, "base64url").toString("utf8");

    expect(decodeHeader(mime, "Subject")).toBe("[محفظة الالتزام] لوحة المتابعة — مشروع تجريبي — W/O 123");
    expect(decodeHeader(mime, "From")).toContain("sender@example.com");             // GMAIL_SENDER يسبق MAIL_FROM
    const to = decodeHeader(mime, "To");
    expect(to.toLowerCase()).toContain("az3919131@gmail.com"); expect(to.toLowerCase()).toContain("other@example.com");   // النطاق غير حساس للحالة
    expect(to.match(/az3919131@gmail\.com/g)).toHaveLength(1);                      // بلا تكرار
    expect(mime).toMatch(/filename="?report\.pdf"?/);
    expect(mime.replace(/\s+/g, "")).toContain(PDF.toString("base64"));            // المرفق سليم بايتًا ببايت
    expect(mime).toContain("Content-Type: text/html");
  });

  it("access token يُعاد استخدامه بين الرسائل (طلب OAuth واحد)", async () => {
    stub(route);
    const p = new GmailApiProvider(gcfg());
    await p.send(msg()); await p.send(msg());
    expect(calls.filter((c) => c.url.includes("oauth2.googleapis.com"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.includes("messages/send"))).toHaveLength(2);
  });

  it("رفض OAuth (invalid_grant) يعيد خطأ بلا أسرار", async () => {
    stub(() => reply(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }));
    const r = await new GmailApiProvider(gcfg()).send(msg());
    expect(r.ok).toBe(false);
    expect(r.error).toBe("OAuth 400: Token has been expired or revoked.");
    for (const s of ["csecret-XYZ", "1//refresh-TOKEN"]) expect(r.error).not.toContain(s);
    expect(calls.some((c) => c.url.includes("messages/send"))).toBe(false);
  });

  it("خطأ 403 من Gmail يظهر برقمه ورسالته", async () => {
    stub((c) => c.url.includes("oauth2") ? reply(200, { access_token: "t", expires_in: 3599 }) : reply(403, { error: { message: "Insufficient Permission" } }));
    expect(await new GmailApiProvider(gcfg()).send(msg())).toEqual({ ok: false, error: "Gmail 403: Insufficient Permission" });
  });

  it("إعدادات ناقصة: لا طلب شبكة، و health يوضح السبب", async () => {
    stub(() => reply(200, {}));
    const p = new GmailApiProvider(cfg({ MAIL_PROVIDER: "gmail_api" }));
    expect(await p.send(msg())).toEqual({ ok: false, error: "إعدادات Gmail API غير مكتملة" });
    expect((await p.health()).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
