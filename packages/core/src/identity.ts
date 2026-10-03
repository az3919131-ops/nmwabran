import type { Catalog, Identity, Project, WoState } from "./types";

/** تطبيع النص العربي/اللاتيني للمقارنة */
export const nz = (s: unknown): string =>
  String(s == null ? "" : s).replace(/[ً-ْ‏‎ ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/ة/g, "ه").replace(/[^\p{L}\p{N}%]+/gu, " ").trim().toLowerCase();

export function normCode(c: unknown): string {
  let s = String(c == null ? "" : c).replace(/[^\d]/g, "");
  if (s.length === 9 && s[0] === "9") s = s.slice(1); // 908111005 → 08111005
  if (s.length === 8 && s[0] === "0") s = s.slice(1); // 08111005 → 8111005
  return s;
}
export const isMatCode = (c: string) => /^8\d{6}$/.test(c) || /^85\d{5}$/.test(c);
export const isWorkCode = (c: string) => /^[2-6]\d{8}$/.test(c);
export const libMat = (cat: Catalog, code: string) => cat.materials.find((m) => m.c === code);
export const libWork = (cat: Catalog, code: string) => cat.works.find((w) => w.c === code);

export const dig = (v: unknown): string => String(v == null ? "" : v).replace(/[^\d]/g, "");
const WO_RE = () => /(?<!\d)\d{8,10}(?!\d)/g;
const ID_LABELS: Record<string, string[]> = {
  wo: ["امر العمل", "رقم امر", "رقم المقايسه", "work order"],
  req: ["رقم الطلب", "uds"], // طلب UDS مرتبط (ثقب أفقي، كشط…) قد يحمل رقمًا آخر لنفس المشروع
  name: ["اسم المشروع", "project name", "المشروع"],
  site: ["موقع المشروع", "موقع امر العمل", "الموقع", "site"],
  admin: ["الاداره", "department"], sector: ["القطاع", "sector"], contractor: ["اسم المقاول", "المقاول", "contractor"],
};
const WO_CTX = /مشروع|امرعمل|امر|عمل|طلب|مقايسه|project|work ?order|uds/i;
/** قيمة اسم/موقع/إدارة مقبولة: نص عربي معتبر لا عنوان عمود إنجليزي مثل UNIT */
const goodVal = (v: unknown) => {
  const s = String(v).trim();
  if (s.length < 3 || s.length > 60 || /^\d+$/.test(s)) return false;
  const ar = (s.match(/[ء-ي]/g) || []).length;
  return ar >= 3 || (/[a-z]/.test(s) && s.length >= 6);
};
const nzz = (v: unknown) => nz(v).replace(/ة/g, "ه").replace(/\s+/g, "");
const STOPW = /^(شركه|شركاه|موسسه|مؤسسه|مقاول|مشروع|اداره|قطاع|company|project)$/;
const toks = (v: unknown) => String(v || "").split(/[\s\-–/،,()]+/).map((t) => nzz(t).replace(/^ال/, "").replace(/^و/, "")).filter((t) => t.length >= 4 && !STOPW.test(t));
/** تقارب نصي يتحمّل اختلاف الصياغة: «الوبران» ≈ «شركة ناصر مانع وبران وشركاه» */
export const near = (a: unknown, b: unknown): boolean => {
  const x = nzz(a), y = nzz(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const A = toks(a), B = toks(b);
  return A.some((t) => B.some((u) => t === u || t.includes(u) || u.includes(t)));
};
const pickTop = (o: Record<string, number>) => Object.keys(o).sort((a, b) => o[b] - o[a])[0];

export function identityFromRows(rows: unknown[][], cat: Catalog): Identity {
  const notLibCode = (x: string) => { const k = normCode(x); return !libWork(cat, k) && !libMat(cat, k); };
  const out: Identity = {}, freq: Record<string, number> = {}, ctx: Record<string, number> = {};
  rows.forEach((r) => {
    r.forEach((c, i) => {
      const h = nz(c); if (!h) return;
      Object.entries(ID_LABELS).forEach(([k, pats]) => {
        if ((out as any)[k]) return;
        if (!pats.some((p) => h.includes(nz(p)))) return;
        for (let j = i + 1; j < Math.min(i + 5, r.length); j++) {
          const v = String(r[j] == null ? "" : r[j]).trim(); if (!v) continue;
          if (k === "wo" || k === "req") { const mm = v.match(WO_RE()); if (mm) { (out as any)[k] = mm[0]; return; } if (/\d\.\d/.test(v)) return; }
          else if (goodVal(v)) { (out as any)[k] = v; return; }
        }
      });
      // رقم أمر العمل يرد داخل نص عنوان ("مشروع الحصينية 234022308")، أما الخلية الرقمية وحدها فهي رقم بند
      const raw = String(c).trim(), d = raw.match(WO_RE());
      if (d && raw.length > d[0].length + 1) {
        const inCtx = WO_CTX.test(nz(raw));
        d.forEach((x) => { if (!notLibCode(x)) return; freq[x] = (freq[x] || 0) + 1; if (inCtx) ctx[x] = (ctx[x] || 0) + 1; });
      }
    });
  });
  if (!out.wo) {
    // الترتيب: رقم طلب مُعنون صراحة > رقم داخل عنوان يذكر «مشروع/أمر عمل» > ترجيح بالتكرار
    const strong = pickTop(ctx);
    if (out.req && (!strong || dig(out.req) !== dig(strong))) { out.wo = out.req; out.woReq = true; }
    else if (strong) out.wo = strong;
    else { const best = pickTop(freq); if (best) { out.wo = best; out.woWeak = true; } }
  }
  if (!out.name) {
    for (const r of rows.slice(0, 6)) {
      for (const c of r) {
        const v = String(c == null ? "" : c).trim();
        if (v.length >= 8 && v.length <= 60 && /مشروع|project/i.test(v) && goodVal(v)) { out.name = v.replace(WO_RE(), "").trim(); out.nameWeak = true; break; }
      }
      if (out.name) break;
    }
  }
  return out;
}
export function identityFromText(text: string, cat: Catalog): Identity {
  const notLibCode = (x: string) => { const k = normCode(x); return !libWork(cat, k) && !libMat(cat, k); };
  const out: Identity = {}, lines = String(text || "").split(/[\n\r]+/);
  lines.forEach((l) => {
    const h = nz(l);
    Object.entries(ID_LABELS).forEach(([k, pats]) => {
      if ((out as any)[k]) return;
      const hit = pats.find((p) => h.includes(nz(p))); if (!hit) return;
      if (k === "wo" || k === "req") { const m = l.match(WO_RE()); if (m) (out as any)[k] = m[0]; }
      else { const v = l.split(/[:：]/).slice(1).join(":").trim(); if (goodVal(v)) (out as any)[k] = v; }
    });
  });
  if (!out.wo) {
    const freq: Record<string, number> = {}, ctx: Record<string, number> = {};
    lines.forEach((l) => {
      const inCtx = WO_CTX.test(nz(l));
      (String(l).match(WO_RE()) || []).forEach((x) => { if (!notLibCode(x)) return; freq[x] = (freq[x] || 0) + 1; if (inCtx) ctx[x] = (ctx[x] || 0) + 1; });
    });
    const strong = pickTop(ctx);
    if (strong) out.wo = strong;
    else if (out.req) { out.wo = out.req; out.woReq = true; }
    else { const best = pickTop(freq); if (best) { out.wo = best; out.woWeak = true; } }
  }
  return out;
}
export function identityFromName(name: string): Identity {
  const m = String(name).match(WO_RE());
  return m ? { wo: m[0], woFromName: true } : {};
}
/** ترجيح < اسم الملف/طلب UDS < أمر عمل صريح داخل الملف */
const identRank = (x?: Identity) => (!x || !x.wo ? 0 : x.woWeak ? 1 : x.woReq || x.woFromName ? 2 : 3);
export function mergeIdent(...list: (Identity | undefined | null)[]): Identity {
  const o: Identity = {}, src = list.filter(Boolean) as Identity[];
  src.forEach((x) => Object.entries(x).forEach(([k, v]) => { if (v && (o as any)[k] == null) (o as any)[k] = v; }));
  const best = src.slice().sort((a, b) => identRank(b) - identRank(a))[0];
  if (best && best.wo) { o.wo = best.wo; o.woWeak = !!best.woWeak; o.woReq = !!best.woReq; o.woFromName = !!best.woFromName; }
  return o;
}
/** الحالة: match | mismatch | related | weak | adopt | none */
export function woState(p: Pick<Project, "wo">, ident?: Identity | null): WoState {
  const a = dig(p.wo), b = ident && ident.wo ? dig(ident.wo) : "";
  if (!b) return "none";
  if (ident!.woWeak && a) return a === b ? "match" : "weak";
  if (!a) return ident!.woReq ? "none" : "adopt"; // لا نعتمد هوية المشروع من رقم طلب UDS فرعي
  if (a === b) return "match";
  return ident!.woReq ? "related" : "mismatch";
}
/** ملء الحقول الفارغة فقط من هوية الملف — لا يُستبدل ما أدخله المستخدم */
export function fillIdent(p: Project, id?: Identity | null): void {
  if (!id) return;
  if (id.site && !String(p.site || "").trim()) p.site = id.site;
  if (id.admin && !String(p.admin || "").trim()) p.admin = id.admin;
  if (id.sector && !String(p.sector || "").trim()) p.sector = id.sector;
  if (id.name && (!String(p.name || "").trim() || /^مشروع تحويل رقم/.test(p.name))) p.name = id.name;
}
