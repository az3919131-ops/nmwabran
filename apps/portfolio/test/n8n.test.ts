import { beforeEach, describe, expect, it, vi } from "vitest";
import { isHttpUrl, loadOverrides, N8nError, resetOverrides, resolveN8n, saveOverrides, sendReview } from "../src/lib/n8n";

const payload = { landingPageUrl: "https://example.com", name: "Omar", comments: "راجع العنوان", lang: "ar" as const };
const ok = (status = 200) => new Response("{}", { status });

beforeEach(() => localStorage.clear());

describe("إعدادات n8n", () => {
  it("بلا تعديل يدوي يُستعمل خادم n8n الافتراضي لصاحب الموقع", () => {
    const r = resolveN8n({ baseUrl: "", webhookUrl: "", formUrl: "" });
    expect(r.baseUrl).toBe("https://vmi3330209.contaboserver.net");
    expect(r.webhookUrl).toBe("https://vmi3330209.contaboserver.net/webhook/0818531a-3892-49f6-af78-cde8d538b205");
    expect(r.configured).toBe(true);
  });

  it("يشتق webhook والنموذج من عنوان الخادم ومعرّف 0818531a…", () => {
    const r = resolveN8n({ baseUrl: "https://n8n.example.com///", webhookUrl: "", formUrl: "" });
    expect(r.webhookUrl).toBe("https://n8n.example.com/webhook/0818531a-3892-49f6-af78-cde8d538b205");
    expect(r.formUrl).toBe("https://n8n.example.com/form/0818531a-3892-49f6-af78-cde8d538b205");
    expect(r.configured).toBe(true);
  });

  it("التعديل اليدوي يتقدم على المشتق، ويُحفظ في localStorage", () => {
    saveOverrides({ baseUrl: "https://a.io/", webhookUrl: " https://hook.io/x ", formUrl: "" });
    const o = loadOverrides();
    expect(o).toEqual({ baseUrl: "https://a.io", webhookUrl: "https://hook.io/x", formUrl: "" });
    expect(resolveN8n(o).webhookUrl).toBe("https://hook.io/x");
    resetOverrides();
    expect(loadOverrides().baseUrl).toBe("");
  });

  it("يقبل http(s) فقط", () => {
    expect(isHttpUrl("https://x.io/a")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("sendReview", () => {
  it("يرفض بلا رابط أو برابط غير آمن قبل أي طلب", async () => {
    const f = vi.fn();
    await expect(sendReview("", payload, { fetchImpl: f })).rejects.toMatchObject({ code: "not-configured" });
    await expect(sendReview("javascript:1", payload, { fetchImpl: f })).rejects.toMatchObject({ code: "invalid-url" });
    expect(f).not.toHaveBeenCalled();
  });

  it("يرسل JSON بالحقول المطلوبة ويعيد delivered", async () => {
    const f = vi.fn().mockResolvedValue(ok());
    await expect(sendReview("https://n8n.io/webhook/x", payload, { fetchImpl: f })).resolves.toBe("delivered");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://n8n.io/webhook/x");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ landingPageUrl: "https://example.com", name: "Omar", comments: "راجع العنوان", source: "ahmed-zahran-portfolio" });
    expect(body.requestId).toBeTruthy();
    expect(new Date(body.submittedAt).toString()).not.toBe("Invalid Date");
  });

  it("حالة غير ناجحة تعطي status مع الرمز", async () => {
    const f = vi.fn().mockResolvedValue(ok(404));
    const err = await sendReview("https://n8n.io/x", payload, { fetchImpl: f }).catch((e) => e);
    expect(err).toBeInstanceOf(N8nError);
    expect(err).toMatchObject({ code: "status", status: 404 });
    expect(f).toHaveBeenCalledTimes(1); // لا إعادة إرسال عند رفض صريح
  });

  it("عند حجب CORS يعيد المحاولة بـ no-cors وبنفس requestId ويعيد unconfirmed", async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ type: "opaque", ok: false, status: 0 });
    await expect(sendReview("https://n8n.io/x", payload, { fetchImpl: f })).resolves.toBe("unconfirmed");
    expect(f).toHaveBeenCalledTimes(2);
    const first = JSON.parse(f.mock.calls[0]![1].body);
    const second = f.mock.calls[1]![1];
    expect(second.mode).toBe("no-cors");
    expect(second.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect((second.body as URLSearchParams).get("requestId")).toBe(first.requestId);
    expect((second.body as URLSearchParams).get("name")).toBe("Omar");
  });

  it("فشل الطلبين معًا = network", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(sendReview("https://n8n.io/x", payload, { fetchImpl: f })).rejects.toMatchObject({ code: "network" });
  });

  it("المهلة تعطي timeout", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))));
    await expect(sendReview("https://n8n.io/x", payload, { fetchImpl: f as unknown as typeof fetch, timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
  });
});
