// يقارن صفحات الواجهة الجديدة بلقطات المنصة القديمة (golden) لمشروع الحصينية: نفس الـHTML الطبيعي حرفيًا.
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CATALOG, hassiniya } from "@iltizam/core";
import golden from "../../../packages/core/test/golden/pages.json";
import { AUTH, S, setCatalog, setContractors } from "../src/runtime";
import { VIEWS } from "../src/render";
import { DECK, buildDeck } from "../src/views/deck";

const norm = (h: string) => String(h).replace(/\s+/g, " ").replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, "DATE");
/**
 * الفروق المقصودة الوحيدة عن المنصة القديمة (موثّقة): الشعار صار ملفًا، وأصول الملفات تُحفظ على الخادم، والذكاء الاصطناعي على الخادم.
 * كل ما عداها يجب أن يتطابق حرفيًا.
 */
const DEVIATIONS: [RegExp | string, string][] = [
  [/src="data:image\/webp;base64,[^"]+"/g, 'src="LOGO"'], [/src="\/src\/assets\/org-logo\.webp"/g, 'src="LOGO"'],
  ["يُحفظ أصل كل ملف يُرفع داخل متصفح جهازك", "يُحفظ أصل كل ملف يُرفع على الخادم"],
  ["Every uploaded file's original is stored inside your browser", "Every uploaded file's original is stored on the server"],
  ["في نسخة claude.ai", "غير مُهيّأ على الخادم"], ["claude.ai copy only", "Not configured on the server"],
  ["المعالجة الذكية تعمل في نسخة المنصة على claude.ai. نسخة الجهاز تستخدم محرك الاستنباط والقراءة المباشرة للملفات بدون إنترنت.", "المعالجة الذكية تعمل من الخادم عند ضبط ANTHROPIC_API_KEY في بيئته. بدونه تعمل المنصة بمحرك الاستنباط والقراءة المباشرة للملفات."],
  ["AI processing runs in the claude.ai copy. The desktop copy uses the deterministic engine and direct file reading, offline.", "AI processing runs on the server when ANTHROPIC_API_KEY is configured in its environment. Without it the platform uses the deterministic engine and direct file reading."],
];
const dev = (h: string) => DEVIATIONS.reduce((x, [a, b]) => (typeof a === "string" ? x.split(a).join(b) : x.replace(a, b)), h);
/** التاريخ الطويل في ترويسة لوحة التحكم يتغير يوميًا — نُسقطه من الجهتين */
const stripToday = (h: string) => h.replace(/<span class="who2">[\s\S]*?<\/span>\s*<\/div>/, "<WHO/>");
const PAGES = ["dash", "firms", "master", "qty", "boq", "wages", "inv", "forms", "map", "recs"] as const;

beforeAll(() => {
  document.body.innerHTML = '<div id="view"></div><div id="toast"></div><div id="deck" hidden></div>';
  setCatalog(DEFAULT_CATALOG);
  setContractors([{ id: "c0", name: "شركة ناصر مانع وبران وشركاه" }, { id: "c1", name: "مقاول آخر / Other contractor" }]);
  const p: any = hassiniya("P1"); p.contractor = 0;
  S.projects = [p]; S.active = 0;
  AUTH.me = { id: "u1", username: "ahmed", name: "م. حمد خليفة", role: "admin", active: true };
  AUTH.unlocked = true;
});

for (const lang of ["ar", "en"] as const) {
  describe(`parity ${lang}`, () => {
    for (const id of PAGES) {
      it(`page ${id} matches the legacy platform`, () => {
        S.lang = lang; S.page = id;
        const mine = dev(stripToday(norm(VIEWS[id]())));
        const want = dev(stripToday((golden as any)[lang][id]));
        if (mine !== want) {
          // أول اختلاف ظاهر للتشخيص
          let i = 0; while (i < mine.length && mine[i] === want[i]) i++;
          throw new Error(`first difference @${i}\nnew:    …${mine.slice(Math.max(0, i - 80), i + 160)}\nlegacy: …${want.slice(Math.max(0, i - 80), i + 160)}`);
        }
        expect(mine).toBe(want);
      });
    }
    it("deck slides match", () => {
      S.lang = lang;
      buildDeck();
      const mine = (DECK.slides as any[]).map((s) => ({ k: s.k, t: s.t || "", h: dev(norm(s.h)) }));
      const want = (golden as any)[lang].deck;
      expect(mine.length).toBe(want.length);
      mine.forEach((s, i) => { expect(s.k).toBe(want[i].k); expect(s.t).toBe(want[i].t); expect(s.h, "slide " + i).toBe(dev(want[i].h)); });
    });
  });
}
