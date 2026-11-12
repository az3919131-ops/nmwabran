import { beforeEach, describe, expect, it } from "vitest";
import seed from "../src/data/site-content.json";
import type { Platform, SiteContent } from "../src/data/content-types";
import {
  clearDraft,
  contentHash,
  emptyContent,
  hostOf,
  loadDraft,
  parseContent,
  pick,
  publishedContent,
  safeUrl,
  saveDraft,
  serializeContent,
  youtubeId,
} from "../src/lib/content";
import * as ops from "../src/lib/contentOps";
import { navItems, renderedSections } from "../src/lib/sections";

const plat = (id: string, extra: Partial<Platform> = {}): Platform => ({
  id,
  name: { ar: `م ${id}`, en: `P ${id}` },
  description: { ar: "", en: "" },
  category: { ar: "", en: "" },
  url: "https://example.com/",
  status: "working",
  icon: "globe",
  ...extra,
});

beforeEach(() => localStorage.clear());

describe("الروابط الآمنة", () => {
  it("تقبل http(s) فقط وترفض javascript: وdata: وغيرها", () => {
    expect(safeUrl("https://a.io/x?y=1#z")).toBe("https://a.io/x?y=1#z");
    expect(safeUrl(" http://a.io ")).toBe("http://a.io/");
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>", "ftp://a.io", "//evil.com", "not a url", "", null, 5]) expect(safeUrl(bad)).toBe("");
  });
  it("المسار النسبي مسموح للملفات فقط، ولا يقبل //", () => {
    expect(safeUrl("/files/cv.pdf", true)).toBe("/files/cv.pdf");
    expect(safeUrl("./cv.pdf", true)).toBe("./cv.pdf");
    expect(safeUrl("//evil.com/x", true)).toBe("");
    expect(safeUrl("/files/cv.pdf", false)).toBe("");
  });
  it("hostOf يعطي النطاق بلا www", () => {
    expect(hostOf("https://www.example.com/a")).toBe("example.com");
    expect(hostOf("x")).toBe("");
  });
});

describe("youtubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=5", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/@Alphamedia-010", null],
    ["https://example.com/watch?v=dQw4w9WgXcQ", null],
    ["nope", null],
  ])("%s", (url, id) => expect(youtubeId(url)).toBe(id));
});

describe("المحتوى الابتدائي", () => {
  it("صالح بعد التطبيع وفيه المنصات والروابط المطلوبة بالضبط", () => {
    const c = publishedContent;
    expect(c.platforms.map((p) => p.url)).toEqual(["https://iltizam-training.netlify.app/#/home", "https://iltizam-najran.netlify.app/"]);
    expect(c.security.map((p) => p.url)).toEqual(["https://securitynmwabran.netlify.app/"]);
    expect(c.youtube[0]?.url).toBe("https://www.youtube.com/@Alphamedia-010");
    expect(c.linkedin.map((p) => p.url)).toEqual(["https://www.linkedin.com/in/ahmed-zahran-8b7730340", "https://www.linkedin.com/in/ahmed-zahran-2815633b4"]);
    expect(c.platforms.filter((p) => p.featured)).toHaveLength(1);
    expect(c.services.length).toBeGreaterThanOrEqual(6);
    expect(c.services.some((s) => s.icon === "layout")).toBe(true); // تصميم المواقع
  });
  it("لا يفقد التطبيعُ شيئًا من الملف (لا عناصر مرفوضة)", () => {
    const raw = seed as unknown as Record<string, unknown[]>;
    for (const k of ["services", "platforms", "security", "youtube", "linkedin"] as const) expect(publishedContent[k]).toHaveLength(raw[k]!.length);
  });
  it("كل نص ثنائي اللغة فيه العربية والإنجليزية", () => {
    const bad: string[] = [];
    const walk = (n: unknown, path: string) => {
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if ("ar" in o && "en" in o && typeof o.ar === "string") {
        if (!o.ar.trim() || !(o.en as string).trim()) bad.push(path);
        return;
      }
      for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    };
    walk(publishedContent, "content");
    expect(bad).toEqual([]);
  });
  it("حالة المنصات مأخوذة من الملف وليست مولّدة", () => {
    expect(publishedContent.platforms.every((p) => ["working", "beta", "stopped"].includes(p.status))).toBe(true);
  });
});

describe("parseContent", () => {
  it("يعيد البديل إن لم يُفهم الإصدار", () => {
    const fb = emptyContent();
    expect(parseContent({ version: 2 }, fb)).toBe(fb);
    expect(parseContent("x", fb)).toBe(fb);
    expect(parseContent(null, fb)).toBe(fb);
  });
  it("يحذف العناصر المعطوبة ويضبط القيم غير الصالحة", () => {
    const c = parseContent(
      {
        version: 1,
        platforms: [
          { id: "ok", name: "منصة", url: "https://a.io", status: "weird", icon: "nope", launchedAt: "2026-3", embed: true },
          { id: "no-url", name: "بلا رابط", url: "javascript:alert(1)" },
          { id: "no-name", name: "", url: "https://a.io" },
          "junk",
        ],
        visibility: { youtube: false },
      },
      emptyContent(),
    );
    expect(c.platforms).toHaveLength(1);
    const p = c.platforms[0]!;
    expect(p.status).toBe("working");
    expect(p.icon).toBe("globe");
    expect(p.launchedAt).toBeUndefined();
    expect(p.embed).toBe(true);
    expect(p.name).toEqual({ ar: "منصة", en: "منصة" }); // نص واحد يصير للغتين
    expect(c.visibility.youtube).toBe(false);
    expect(c.visibility.platforms).toBe(true);
  });
  it("معرّفات فريدة وصالحة حتى لو تكررت أو فُقدت", () => {
    const c = parseContent({ version: 1, pages: [{ id: "a", title: "1", url: "https://a.io" }, { id: "a", title: "2", url: "https://b.io" }, { title: "3", url: "https://c.io" }] }, emptyContent());
    const ids = c.pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((i) => /^[\w-]{1,64}$/.test(i))).toBe(true);
  });
  it("الأقسام المخصصة: صور وملفات تقبل المسار النسبي، والبطاقات الفارغة تُحذف", () => {
    const c = parseContent(
      { version: 1, custom: [{ id: "s1", title: "ملفاتي", kind: "file", visible: false, cards: [{ id: "c1", title: "سيرتي", url: "/files/cv.pdf", fileType: "PDF" }, { id: "c2", title: "", url: "https://a.io" }, { id: "c3", title: "سيئ", url: "javascript:1" }] }] },
      emptyContent(),
    );
    const s = c.custom[0]!;
    expect(s.visible).toBe(false);
    expect(s.kind).toBe("file");
    expect(s.cards.map((x) => x.id)).toEqual(["c1", "c3"]);
    expect(s.cards[0]).toMatchObject({ url: "/files/cv.pdf", fileType: "PDF" });
    expect(s.cards[1]!.url).toBeUndefined();
  });
  it("الفيديوهات تُقبل بروابط آمنة فقط", () => {
    const c = parseContent({ version: 1, youtube: [{ id: "y", name: "قناة", url: "https://youtube.com/@x", videos: [{ id: "v1", title: "فيديو", url: "https://youtu.be/dQw4w9WgXcQ" }, { id: "v2", title: "x", url: "javascript:1" }] }] }, emptyContent());
    expect(c.youtube[0]!.videos).toHaveLength(1);
  });
  it("الإحصاءات اليدوية تظهر فقط إن أُدخلت", () => {
    const c = parseContent({ version: 1, youtube: [{ id: "a", name: "أ", url: "https://youtube.com/@a" }, { id: "b", name: "ب", url: "https://youtube.com/@b", subscribers: "12K", views: " 1.2M " }] }, emptyContent());
    expect(c.youtube[0]!.subscribers).toBeUndefined();
    expect(c.youtube[0]!.views).toBeUndefined();
    expect(c.youtube[1]).toMatchObject({ subscribers: "12K", views: "1.2M" });
  });
  it("التسلسل ثم التحليل يعطي المحتوى نفسه", () => {
    expect(parseContent(JSON.parse(serializeContent(publishedContent)), emptyContent())).toEqual(publishedContent);
  });
});

describe("pick", () => {
  it("يرجع للغة الأخرى إن كانت الحالية فارغة", () => {
    expect(pick({ ar: "أ", en: "" }, "en")).toBe("أ");
    expect(pick({ ar: "", en: "b" }, "ar")).toBe("b");
    expect(pick(undefined, "ar")).toBe("");
  });
});

describe("عمليات التحرير", () => {
  const base: SiteContent = { ...emptyContent(), platforms: [plat("a"), plat("b"), plat("c")] };
  it("إضافة وتعديل وحذف دون تغيير الأصل", () => {
    const added = ops.addItem(base, "platforms", plat("d"));
    expect(added.platforms.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(base.platforms).toHaveLength(3);
    expect(ops.updateItem(added, "platforms", "d", { status: "beta" }).platforms[3]!.status).toBe("beta");
    expect(ops.removeItem(added, "platforms", "a").platforms.map((p) => p.id)).toEqual(["b", "c", "d"]);
  });
  it("النقل لا يتجاوز الحدود", () => {
    expect(ops.moveItem(base, "platforms", "b", -1).platforms.map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(ops.moveItem(base, "platforms", "a", -1).platforms.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(ops.moveItem(base, "platforms", "c", 1).platforms.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("الإخفاء يتبدل ذهابًا وإيابًا", () => {
    const h = ops.toggleHidden(base, "platforms", "b");
    expect(h.platforms[1]!.hidden).toBe(true);
    expect("hidden" in ops.toggleHidden(h, "platforms", "b").platforms[1]!).toBe(false);
  });
  it("إظهار القسم وإخفاؤه", () => {
    expect(ops.setVisible(base, "youtube", false).visibility.youtube).toBe(false);
  });
  it("الأقسام المخصصة وبطاقاتها", () => {
    let c = ops.addSection(base, { id: "s1", title: { ar: "قسمي", en: "Mine" }, kind: "text", visible: true, cards: [] });
    c = ops.addCard(c, "s1", { id: "k1", title: { ar: "أ", en: "a" } });
    c = ops.addCard(c, "s1", { id: "k2", title: { ar: "ب", en: "b" } });
    expect(c.custom[0]!.cards.map((x) => x.id)).toEqual(["k1", "k2"]);
    c = ops.moveCard(c, "s1", "k2", -1);
    expect(c.custom[0]!.cards.map((x) => x.id)).toEqual(["k2", "k1"]);
    c = ops.toggleCardHidden(c, "s1", "k1");
    expect(c.custom[0]!.cards[1]!.hidden).toBe(true);
    c = ops.updateSection(c, "s1", { visible: false, kind: "link" });
    expect(c.custom[0]).toMatchObject({ visible: false, kind: "link" });
    c = ops.removeCard(c, "s1", "k2");
    expect(c.custom[0]!.cards).toHaveLength(1);
    expect(ops.removeSection(c, "s1").custom).toHaveLength(0);
  });
});

describe("خطة الأقسام والتنقل", () => {
  it("الأقسام الظاهرة بالترتيب وعنصر تنقل لكل مجموعة", () => {
    const ids = renderedSections(publishedContent, false).map((e) => e.id);
    expect(ids).toEqual(["about", "services", "experience", "projects", "platforms", "security", "youtube", "linkedin", "certifications", "contact"]);
    expect(navItems(renderedSections(publishedContent, false)).map((e) => e.group)).toEqual(["about", "services", "experience", "projects", "platforms", "presence", "certifications", "contact"]);
  });
  it("القسم الفارغ أو المخفي لا يظهر للزوار لكنه يظهر في التحرير", () => {
    const c = ops.setVisible(publishedContent, "platforms", false);
    expect(renderedSections(c, false).some((e) => e.id === "platforms")).toBe(false);
    expect(renderedSections(c, true).some((e) => e.id === "platforms")).toBe(true);
    expect(renderedSections(c, false).some((e) => e.id === "pages")).toBe(false); // فارغ
    expect(renderedSections(c, true).some((e) => e.id === "pages")).toBe(true);
  });
  it("إخفاء كل عناصر القسم يخفيه عن الزوار", () => {
    let c = publishedContent;
    for (const p of c.platforms) c = ops.toggleHidden(c, "platforms", p.id);
    expect(renderedSections(c, false).some((e) => e.id === "platforms")).toBe(false);
  });
  it("الأقسام المخصصة تنضم لمجموعة الحضور الرقمي", () => {
    const c = ops.addCard(ops.addSection(publishedContent, { id: "x", title: { ar: "ق", en: "S" }, kind: "link", visible: true, cards: [] }), "x", { id: "k", title: { ar: "أ", en: "a" } });
    const plan = renderedSections(c, false);
    expect(plan.find((e) => e.id === "custom-x")?.group).toBe("presence");
  });
});

describe("المسودة المحلية", () => {
  it("تُحمَّل فقط مع نفس بصمة النسخة المنشورة", () => {
    const h = contentHash(publishedContent);
    const edited = ops.addItem(publishedContent, "pages", { id: "p", title: { ar: "ص", en: "P" }, description: { ar: "", en: "" }, url: "https://a.io/" });
    expect(saveDraft(h, edited)).toBe(true);
    expect(loadDraft(h, publishedContent)?.pages).toHaveLength(1);
    expect(loadDraft("other", publishedContent)).toBeNull(); // نشر جديد ← تُهمل المسودة
    clearDraft();
    expect(loadDraft(h, publishedContent)).toBeNull();
  });
  it("تُنظَّف المسودة عند التحميل (لا روابط خطرة)", () => {
    const h = contentHash(publishedContent);
    localStorage.setItem("nm.content.draft", JSON.stringify({ base: h, content: { version: 1, pages: [{ id: "x", title: "س", url: "javascript:alert(1)" }] } }));
    expect(loadDraft(h, publishedContent)?.pages).toHaveLength(0);
  });
  it("البصمة تتغير بتغير المحتوى", () => {
    expect(contentHash(publishedContent)).not.toBe(contentHash(ops.setVisible(publishedContent, "pages", false)));
    expect(contentHash(publishedContent)).toBe(contentHash(publishedContent));
  });
});
