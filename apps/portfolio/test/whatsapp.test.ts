import { describe, expect, it } from "vitest";
import { formatPhone } from "../src/config";
import { buildContactMessage, waChatLink, waLink } from "../src/lib/whatsapp";

describe("واتساب", () => {
  it("يبني رابط api.whatsapp.com برقم المالك ونص مرمّز", () => {
    const u = new URL(waLink("مرحبا & أهلا"));
    expect(u.origin + u.pathname).toBe("https://api.whatsapp.com/send");
    expect(u.searchParams.get("phone")).toBe("966565324387");
    expect(u.searchParams.get("text")).toBe("مرحبا & أهلا");
  });

  it("يحذف الرموز من الرقم ويتجاهل النص الفارغ", () => {
    expect(waLink("  ", "+966 50 000")).toBe("https://api.whatsapp.com/send?phone=96650000");
    expect(waChatLink("+966 50-000")).toBe("https://wa.me/96650000");
  });

  it("يصوغ رسالة النموذج بالاسم والنص في اللغتين", () => {
    const ar = buildContactMessage({ name: " خالد ", message: " أحتاج عرضًا ", lang: "ar" });
    expect(ar).toContain("معك خالد.");
    expect(ar).toContain("أحتاج عرضًا");
    const en = buildContactMessage({ name: "Omar", message: "Quote please", lang: "en" });
    expect(en.startsWith("Hello Eng. Ahmed, this is Omar.")).toBe(true);
  });

  it("ينسّق الرقم السعودي", () => {
    expect(formatPhone("966565324387")).toBe("+966 56 532 4387");
    expect(formatPhone("20100")).toBe("+20100");
  });
});
