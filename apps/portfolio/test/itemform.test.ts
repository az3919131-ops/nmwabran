import { describe, expect, it } from "vitest";
import { cardFields, CHANNEL_FIELDS, PLATFORM_FIELDS, SECTION_FIELDS } from "../src/landing/content/fields";
import { collect, validate } from "../src/landing/content/ItemForm";
import { formatLaunch } from "../src/lib/format";

const base = { name: { ar: "منصة", en: "" }, description: { ar: "", en: "" }, category: { ar: "", en: "" }, url: "https://a.io", status: "working", icon: "globe" };

describe("التحقق من نموذج المنصة", () => {
  it("يقبل بيانات صالحة بلغة واحدة", () => {
    expect(validate(PLATFORM_FIELDS, base)).toEqual({});
  });
  it("الاسم والرابط مطلوبان", () => {
    const errs = validate(PLATFORM_FIELDS, { ...base, name: { ar: " ", en: "" }, url: "" });
    expect(Object.keys(errs).sort()).toEqual(["name", "url"]);
  });
  it.each(["javascript:alert(1)", "ftp://a.io", "data:text/html,x", "a b", "//evil.com"])("يرفض الرابط %s", (url) => {
    expect(validate(PLATFORM_FIELDS, { ...base, url }).url).toBeDefined();
  });
  it("صورة اختيارية: تُرفض الخطيرة وتُقبل الفارغة", () => {
    expect(validate(PLATFORM_FIELDS, { ...base, imageUrl: "javascript:1" }).imageUrl).toBeDefined();
    expect(validate(PLATFORM_FIELDS, { ...base, imageUrl: "" }).imageUrl).toBeUndefined();
  });
  it("تاريخ الإطلاق: 2026 أو 2026-03 أو 2026-03-15 فقط", () => {
    for (const ok of ["2026", "2026-03", "2026-03-15", ""]) expect(validate(PLATFORM_FIELDS, { ...base, launchedAt: ok }).launchedAt).toBeUndefined();
    for (const bad of ["26", "2026-3", "مارس 2026", "2026/03"]) expect(validate(PLATFORM_FIELDS, { ...base, launchedAt: bad }).launchedAt).toBeDefined();
  });
});

describe("collect", () => {
  it("يقصّ النصوص ويحذف الاختياري الفارغ ويحوّل الخانات", () => {
    const out = collect(PLATFORM_FIELDS, { ...base, name: { ar: " منصة ", en: " P " }, url: " https://a.io ", imageUrl: "", launchedAt: " 2026-03 ", featured: true, embed: false });
    expect(out.name).toEqual({ ar: "منصة", en: "P" });
    expect(out.url).toBe("https://a.io/");
    expect(out.imageUrl).toBeUndefined();
    expect(out.launchedAt).toBe("2026-03");
    expect(out.featured).toBe(true);
    expect(out.embed).toBeUndefined();
    expect(out.status).toBe("working");
  });
});

describe("الفيديوهات المميزة", () => {
  it("صف ناقص أو برابط خطر يُخطَّأ، والصفوف الفارغة تُحذف", () => {
    const ch = { name: { ar: "ق", en: "" }, url: "https://youtube.com/@x" };
    expect(validate(CHANNEL_FIELDS, { ...ch, videos: [{ id: "1", title: "فيديو", url: "javascript:1" }] }).videos).toBeDefined();
    expect(validate(CHANNEL_FIELDS, { ...ch, videos: [{ id: "1", title: "", url: "https://youtu.be/dQw4w9WgXcQ" }] }).videos).toBeDefined();
    expect(validate(CHANNEL_FIELDS, { ...ch, videos: [{ id: "1", title: "", url: "" }] }).videos).toBeUndefined();
    const out = collect(CHANNEL_FIELDS, { ...ch, videos: [{ id: "1", title: " فيديو ", url: "https://youtu.be/dQw4w9WgXcQ" }, { id: "2", title: "", url: "" }] });
    expect(out.videos).toEqual([{ id: "1", title: "فيديو", url: "https://youtu.be/dQw4w9WgXcQ" }]);
  });
});

describe("نماذج الأقسام المخصصة", () => {
  it("حقول البطاقة تتبع شكل القسم", () => {
    expect(cardFields("text").map((f) => f.key)).toEqual(["title", "body"]);
    expect(cardFields("image").map((f) => f.key)).toEqual(["title", "imageUrl", "body", "url"]);
    expect(cardFields("file").map((f) => f.key)).toEqual(["title", "url", "fileType", "body"]);
    expect(cardFields("link").map((f) => f.key)).toEqual(["title", "url", "body"]);
  });
  it("بطاقة الملف تقبل مسارًا نسبيًا ولا تقبل http غريبًا", () => {
    const fields = cardFields("file");
    expect(validate(fields, { title: { ar: "سيرة", en: "" }, url: "/files/cv.pdf" })).toEqual({});
    expect(validate(fields, { title: { ar: "سيرة", en: "" }, url: "javascript:1" }).url).toBeDefined();
    expect(validate(fields, { title: { ar: "سيرة", en: "" }, url: "" }).url).toBeDefined();
  });
  it("نموذج القسم يطلب عنوانًا فقط", () => {
    expect(validate(SECTION_FIELDS, { title: { ar: "", en: "" }, kind: "link", visible: true }).title).toBeDefined();
    expect(validate(SECTION_FIELDS, { title: { ar: "قسمي", en: "" }, kind: "text", visible: true })).toEqual({});
  });
});

describe("formatLaunch", () => {
  it("يعرض السنة أو الشهر والسنة أو التاريخ كاملًا بأرقام لاتينية", () => {
    expect(formatLaunch("2026", "en")).toBe("2026");
    expect(formatLaunch("2026-03", "en")).toBe("March 2026");
    expect(formatLaunch("2026-03-15", "en")).toBe("15 March 2026");
    expect(formatLaunch("2026-03", "ar")).toMatch(/2026/);
    expect(formatLaunch("غير صالح", "en")).toBe("غير صالح");
  });
});
