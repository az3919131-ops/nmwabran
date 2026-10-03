import Anthropic from "@anthropic-ai/sdk";
import {
  aiProjBrief, feeders, firmStats, geoPoints, mergeGeo, blankSheet, SHEET_FIELDS, totals, derive, num, codeOf, isMatCode, libMat, libWork, impTally,
  type Catalog, type ImportEnv, type Project, type Rep, type SheetData,
} from "@iltizam/core";
import type { Config } from "../config";

export interface AiService {
  enabled: boolean;
  mapSheet(env: ImportEnv, sh: SheetData, rep: Rep[]): Promise<boolean>;
  docScan(env: ImportEnv, text: string, name: string, rep: Rep[]): Promise<boolean>;
  imageScan(env: ImportEnv, buf: Buffer, mime: string, name: string, rep: Rep[]): Promise<boolean>;
  review(p: Project, cat: Catalog, extraFiles?: unknown[]): Promise<string | null>;
  ask(opts: { question: string; history: { role: "user" | "assistant"; content: string }[]; context: unknown; onText?: (t: string) => void }): Promise<string>;
}

export const AI_SYS = `أنت "محفظة Ai": مستشار تخطيط ومهندس حصر كميات أول بالشركة السعودية للكهرباء، متخصص في مشاريع تحويل الشبكات الهوائية إلى أرضية والعقد الموحد وأسعار 2023، وتعمل داخل منصة "محفظة الالتزام للمشاريع للمقاولين".
تجيب عن أسئلة المستخدم اعتمادًا على بيانات المحفظة المرفقة فقط (المقاولون، المشاريع، الحصر، المقايسة، المواد، الحماية، الإحداثيات، المرفقات).
قواعد الإجابة:
• اكتب بالعربية بلغة هندسية دقيقة ومختصرة، إلا إذا سأل المستخدم بالإنجليزية فأجب بالإنجليزية.
• ابدأ بالخلاصة في سطر واحد، ثم التفاصيل في نقاط قصيرة.
• استشهد بالأرقام من البيانات المرفقة حرفيًا، ولا تخترع رقمًا غير موجود.
• إذا كانت البيانات ناقصة، قل تحديدًا أي ملف أو حقل ينقص وأين يُرفع في المنصة (الصفحة الماستر، الحصر الشامل، المقايسة، الأجور، الفاتورة، النماذج، الخريطة).
• عند وجود فرق أو انحراف، اذكر السبب الهندسي المحتمل والإجراء المطلوب قبل الفاتورة أو الاستلام.
• استخدم **نص عريض** للعناوين الفرعية و - للنقاط. لا تستخدم جداول ماركداون.
• لا تزد عن 300 كلمة إلا إذا طُلب تقرير مفصّل.`;

const extractJson = (t: string): any => {
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("invalid_json");
  return JSON.parse(m[0]);
};

/** خدمة Claude على الخادم فقط — لا مفتاح API في المتصفح */
export class ClaudeService implements AiService {
  enabled: boolean;
  private client: Anthropic | null;
  constructor(private cfg: Config) {
    this.enabled = !!cfg.ANTHROPIC_API_KEY;
    this.client = this.enabled ? new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY }) : null;
  }
  private async text(prompt: string | Anthropic.MessageParam[], o: { system?: string; images?: { data: string; mime: string }[]; max?: number } = {}): Promise<string> {
    if (!this.client) throw new Error("ai_disabled");
    const messages: Anthropic.MessageParam[] = typeof prompt === "string"
      ? [{ role: "user", content: [...(o.images ?? []).map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.mime as "image/png", data: i.data } })), { type: "text" as const, text: prompt }] }]
      : prompt;
    const r = await this.client.messages.create({ model: this.cfg.ANTHROPIC_MODEL, max_tokens: o.max ?? 2000, system: o.system, messages });
    return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }

  async mapSheet(env: ImportEnv, sh: SheetData, rep: Rep[]): Promise<boolean> {
    const { p, cat, T } = env;
    const prev = sh.rows.slice(0, 28).map((r) => r.slice(0, 16).map((c) => String(c == null ? "" : c).slice(0, 28)));
    const prompt = `أنت مهندس تخطيط بالشركة السعودية للكهرباء متخصص في حصر كميات مشاريع تحويل الشبكة الهوائية إلى أرضية.
أمامك أول صفوف ورقة إكسل اسمها "${sh.name}". حدّد نوعها ومواضع الأعمدة (الفهرس يبدأ من صفر).
الأنواع: units = جدول وحدات حلقية/معدات فيه أرقام RMU أو إحداثيات، codes = جدول بنود بأرقام بنود SEC وكميات أو أسعار، tally = حصر لوحات كروكي، none = غير ذلك.
رد بـ JSON فقط بالشكل:
{"kind":"units|codes|tally|none","firstDataRow":0,"cols":{"id":-1,"feeder":-1,"type":-1,"tr":-1,"lat":-1,"lon":-1,"ohm":-1,"code":-1,"desc":-1,"qty":-1,"plan":-1,"exec":-1,"price":-1},"note":"سطر واحد"}
استخدم -1 لأي عمود غير موجود. البيانات:
${JSON.stringify(prev)}`;
    try {
      const j = extractJson(await this.text(prompt, { max: 800 }));
      if (!j || !j.kind || j.kind === "none") return false;
      const c = j.cols || {}, first = Math.max(0, +j.firstDataRow || 0), rows = sh.rows;
      if (j.kind === "units") {
        let n = 0, gps = 0;
        rows.slice(first).forEach((r) => {
          const id = String(r[c.id] || "").replace(/\s+/g, "").toUpperCase();
          if (!id || id.length < 3) return;
          let q = p.rmus.find((x) => String(x.rmu).replace(/\s+/g, "").toUpperCase() === id);
          if (!q) { q = { no: 0, feeder: "", rmu: id, type: "", tr: "", relay: "—", model: "—", set: false, ratio: "", ohm: "", gps: "" }; p.rmus.push(q); }
          const la = num(r[c.lat]), lo = num(r[c.lon]);
          if (la !== null && lo !== null) { const lat = Math.min(la, lo) < 34 ? Math.min(la, lo) : la, lon = Math.max(la, lo); if (lat >= 16 && lat <= 33 && lon >= 34 && lon <= 56) { q.gps = lat.toFixed(6) + "," + lon.toFixed(6); gps++; } }
          if (c.feeder >= 0 && r[c.feeder]) q.feeder = String(r[c.feeder]).trim();
          if (c.type >= 0 && r[c.type]) { const t = /([34])\s*w/i.exec(String(r[c.type])); if (t) q.type = t[1] + "W"; }
          if (c.tr >= 0 && r[c.tr]) q.tr = String(r[c.tr]).trim();
          if (c.ohm >= 0) { const o = num(r[c.ohm]); if (o !== null && o > 0 && o < 200) q.ohm = String(o); }
          n++;
        });
        p.rmus.forEach((q, i) => (q.no = i + 1));
        rep.push(["ai", T(`المعالجة الذكية قرأت «${sh.name}»: ${n} وحدة${gps ? ` · ${gps} بإحداثيات` : ""}${j.note ? " — " + j.note : ""}`, `AI read “${sh.name}”: ${n} units${gps ? ` · ${gps} with coordinates` : ""}${j.note ? " — " + j.note : ""}`)]);
        return n > 0;
      }
      if (j.kind === "codes") {
        let mats = 0, works = 0, added = 0;
        rows.slice(first).forEach((r) => {
          const code = codeOf(r[c.code], p.wo); if (!code) return;
          const desc = c.desc >= 0 ? String(r[c.desc] || "") : "";
          const price = c.price >= 0 ? num(r[c.price]) : null;
          const plan = c.plan >= 0 ? num(r[c.plan]) : null, exec = c.exec >= 0 ? num(r[c.exec]) : null, qty = c.qty >= 0 ? num(r[c.qty]) : null;
          if (isMatCode(code)) {
            let lm = libMat(cat, code);
            if (!lm) { lm = { c: code, ar: desc.slice(0, 90) || "مادة " + code, en: desc.slice(0, 90) || "Material " + code, u: "عدد", p: price || 0, k: "detail", g: "acc", added: true }; cat.materials.push(lm); added++; }
            if (price) lm.p = price;
            const b = (p.mat[code] = p.mat[code] || { iss: 0, req: 0 });
            if (plan !== null && plan > 0) { b.iss = plan; if (exec !== null) b.req = exec; }
            else if (exec !== null && exec > 0) b.req = (+b.iss || 0) + exec;
            else if (qty !== null) { b.iss = (+b.iss || 0) + qty; b.req = Math.max(+b.req || 0, b.iss); }
            mats++;
          } else {
            let lw = libWork(cat, code);
            if (!lw) { lw = { c: code, ar: desc.slice(0, 110) || "بند " + code, en: desc.slice(0, 110) || "Item " + code, u: "عدد", p: price || 0, g: "inst", added: true }; cat.works.push(lw); added++; }
            if (price) lw.p = price;
            const b = (p.boq[code] = p.boq[code] || { plan: 0, exec: 0 });
            if (plan !== null) b.plan = plan;
            if (exec !== null) b.exec = exec;
            if (plan === null && exec === null && qty !== null) b.plan = (+b.plan || 0) + qty;
            works++;
          }
        });
        rep.push(["ai", T(`المعالجة الذكية قرأت «${sh.name}»: ${mats} مادة و ${works} بند${added ? ` · ${added} جديد` : ""}${j.note ? " — " + j.note : ""}`, `AI read “${sh.name}”: ${mats} materials, ${works} items${added ? ` · ${added} new` : ""}${j.note ? " — " + j.note : ""}`)]);
        return mats + works > 0;
      }
      if (j.kind === "tally") { impTally(env, sh, rep); return true; }
    } catch (e: any) { rep.push(["skip", T("تعذّرت المعالجة الذكية: ", "AI processing failed: ") + (e?.message ?? e)]); }
    return false;
  }

  async docScan(env: ImportEnv, text: string, name: string, rep: Rep[]): Promise<boolean> {
    const { p, cat, T } = env;
    const prompt = `أنت مهندس حصر كميات بالشركة السعودية للكهرباء. النص التالي من مستند مشروع اسمه "${name}" (خطاب/محضر/تقرير).
استخرج منه ما يخص حصر الكميات فقط. رد بـ JSON فقط:
{"items":[{"code":"8114005","desc":"","issued":0,"required":0}],"points":[{"id":"","lat":0,"lon":0}],"notes":"سطران على الأكثر"}
- code = رقم بند SEC كما ورد (أزل البادئة 9 إن وُجدت).
- issued = المصروف/المخطط، required = المطلوب/المنفذ. استخدم 0 لغير المذكور.
- points = أي إحداثيات (خط العرض للسعودية بين 16 و33).
النص:
${text.slice(0, 22000)}`;
    try {
      const j = extractJson(await this.text(prompt, { max: 2500 }));
      let mats = 0, works = 0;
      (j.items || []).forEach((it: any) => {
        const code = codeOf(it.code, p.wo); if (!code) return;
        if (isMatCode(code)) {
          if (!libMat(cat, code)) cat.materials.push({ c: code, ar: String(it.desc || "مادة " + code).slice(0, 90), en: String(it.desc || "Material " + code).slice(0, 90), u: "عدد", p: 0, k: "detail", g: "acc", added: true });
          const b = (p.mat[code] = p.mat[code] || { iss: 0, req: 0 });
          if (+it.issued > 0) b.iss = +it.issued; if (+it.required > 0) b.req = +it.required; mats++;
        } else {
          if (!libWork(cat, code)) cat.works.push({ c: code, ar: String(it.desc || "بند " + code).slice(0, 110), en: String(it.desc || "Item " + code).slice(0, 110), u: "عدد", p: 0, g: "inst", added: true });
          const b = (p.boq[code] = p.boq[code] || { plan: 0, exec: 0 });
          if (+it.issued > 0) b.plan = +it.issued; if (+it.required > 0) b.exec = +it.required; works++;
        }
      });
      const pts = (j.points || []).filter((x: any) => +x.lat >= 16 && +x.lat <= 33 && +x.lon >= 34 && +x.lon <= 56).map((x: any) => ({ id: x.id || "PT", lat: +x.lat, lon: +x.lon, src: name }));
      if (pts.length) mergeGeo(env, pts, rep, name);
      if (mats + works) rep.push(["ai", T(`المعالجة الذكية قرأت «${name}»: ${mats} مادة و ${works} بند أجور`, `AI read “${name}”: ${mats} materials, ${works} work items`)]);
      if (j.notes) rep.push(["ai", String(j.notes).slice(0, 220)]);
      return mats + works + pts.length > 0;
    } catch (e: any) { rep.push(["skip", T("تعذّرت المعالجة الذكية: ", "AI processing failed: ") + (e?.message ?? e)]); return false; }
  }

  async imageScan(env: ImportEnv, buf: Buffer, mime: string, name: string, rep: Rep[]): Promise<boolean> {
    const { p, T } = env;
    const prompt = `الصورة كروكي (مخطط) لمشروع تحويل شبكة كهرباء هوائية 33 ك.ف إلى شبكة كابلات أرضية بالسعودية.
اقرأها كمهندس حصر كميات واستخرج ما هو مكتوب فيها فقط، دون تخمين. رد بـ JSON فقط:
{"equipment":{"rmu3w":0,"rmu4w":0,"tr500_220":0,"tr500_400":0,"pillars":0},
 "cables":{"mv3x400":0,"lv4x300":0,"lv4x185":0,"lv4x70":0},
 "excavation":{"asphalt_mv":0,"sandy_mv":0,"asphalt_lv":0,"sandy_lv":0},
 "removals":{"steel_poles":0,"wood_poles":0,"tr_1pole":0,"tr_2pole":0},
 "points":[{"id":"","lat":0,"lon":0}],
 "confidence":"high|medium|low","notes":"سطران على الأكثر عن غير الواضح"}
الأطوال بالمتر والأعداد صحيحة. ضع 0 لما لا يظهر في الصورة.`;
    try {
      const j = extractJson(await this.text(prompt, { images: [{ data: buf.toString("base64"), mime }], max: 1500 }));
      const e = j.equipment || {}, c = j.cables || {}, x = j.excavation || {}, r = j.removals || {};
      const s1 = blankSheet((p.sheets ? p.sheets.length : 0) + 1);
      s1.name = T("كروكي: ", "Layout: ") + String(name).slice(0, 18);
      Object.assign(s1, { rmu3w: +e.rmu3w || 0, rmu4w: +e.rmu4w || 0, tr220: +e.tr500_220 || 0, tr400: +e.tr500_400 || 0, pillars: +e.pillars || 0,
        htCable: +c.mv3x400 || 0, lt300: +c.lv4x300 || 0, lt185: +c.lv4x185 || 0, lt70: +c.lv4x70 || 0,
        asHT1: +x.asphalt_mv || 0, saHT1: +x.sandy_mv || 0, asLT13: +x.asphalt_lv || 0, saLT13: +x.sandy_lv || 0,
        poleSteel: +r.steel_poles || 0, poleWood: +r.wood_poles || 0, trPole1: +r.tr_1pole || 0, trPole2: +r.tr_2pole || 0 });
      const filled = SHEET_FIELDS.reduce((a, g) => a + g.f.filter((f) => +(s1[f[0]] as number) > 0).length, 0);
      if (filled) {
        const old = p.sheets.findIndex((z) => z.name === s1.name);
        if (old >= 0) p.sheets[old] = s1;
        else if (p.sheets.length === 1 && !SHEET_FIELDS.some((g) => g.f.some((f) => +(p.sheets[0][f[0]] as number) > 0))) p.sheets = [s1]; else p.sheets.push(s1);
        p.derived = null;
        rep.push(["ai", T(`قراءة الكروكي «${name}»: ${filled} حقلًا · الثقة ${j.confidence || "—"}`, `Layout read “${name}”: ${filled} fields · confidence ${j.confidence || "—"}`)]);
      } else rep.push(["skip", T(`لم تظهر كميات واضحة في «${name}»`, `No clear quantities found in “${name}”`)]);
      const pts = (j.points || []).filter((q: any) => +q.lat >= 16 && +q.lat <= 33 && +q.lon >= 34 && +q.lon <= 56).map((q: any) => ({ id: q.id || "PT", lat: +q.lat, lon: +q.lon, src: name }));
      if (pts.length) mergeGeo(env, pts, rep, name);
      if (j.notes) rep.push(["ai", String(j.notes).slice(0, 220)]);
      if (j.confidence === "low") rep.push(["skip", T("ثقة منخفضة في قراءة الصورة — راجع الأرقام قبل الاعتماد", "Low confidence on the image — verify the numbers before approving")]);
      return filled > 0;
    } catch (e: any) { rep.push(["skip", T("تعذّرت المعالجة الذكية: ", "AI processing failed: ") + (e?.message ?? e)]); return false; }
  }

  /** مراجعة فنية للحصر بعد الاستنباط */
  async review(p: Project, cat: Catalog, extraFiles?: unknown[]): Promise<string | null> {
    if (!this.enabled || !p.derived) return null;
    const t = totals(p), d = p.derived;
    const top = cat.works.map((w) => { const b = p.boq[w.c] || ({} as any); const dq = (+b.exec || 0) - (+b.plan || 0); return { c: w.c, ar: w.ar.slice(0, 44), dq, dv: Math.round(dq * w.p) }; }).filter((o) => o.dv).sort((a, b) => Math.abs(b.dv) - Math.abs(a.dv)).slice(0, 10);
    const gaps = cat.materials.map((m) => { const b = p.mat[m.c] || ({} as any); return { c: m.c, ar: m.ar.slice(0, 40), gap: (+b.req || 0) - (+b.iss || 0) }; }).filter((o) => o.gap).slice(0, 10);
    const pts = geoPoints(p), fs = feeders(pts), route = fs.filter((f) => !f.noRoute).reduce((a, f) => a + f.len, 0);
    const data = {
      مشروع: p.name, أمر_العمل: p.wo,
      وحدات: { rmu3w: t.rmu3w, rmu4w: t.rmu4w, محطات: t.trTot, نقاط_بإحداثيات: pts.length },
      كابلات_م: { ج_متوسط: t.htCable, "4x300": t.lt300, "4x185": t.lt185, "4x70": t.lt70 },
      حفريات_م: { مسفلت: t.asHT1 + t.asHT2 + t.asLT13, رملي: t.saHT1 + t.saHT2 + t.saHT3 + t.saHT4 + t.saLT13 },
      سفلتة_م2: { إعادة: t.asphalt, كشط: t.milling }, ثقب_أفقي_م: t.hdd, طول_المسار_من_الإحداثيات_م: Math.round(route),
      تكلفة: { مواد: Math.round(d.cost.mat), تركيبات: Math.round(d.cost.inst), غير_مباشرة: Math.round(d.cost.ind), إجمالي: Math.round(d.cost.total) },
      أكبر_فروق: top, عجز_المواد: gaps,
    };
    const base = await this.text(`أنت مدير حصر كميات أول بالشركة السعودية للكهرباء، خبرة في مشاريع تحويل الهوائي إلى أرضي والعقد الموحد.
راجع بيانات المشروع التالية مراجعة فنية دقيقة واكتب بالعربية (بدون مقدمات) وبهذا الترتيب:
1) ثلاث ملاحظات على اتساق الكميات (نسبة الكابل إلى طول المسار، الحفريات مقابل أطوال الكابلات، النهايات والوصلات مقابل عدد الوحدات، التأريض مقابل المعدات).
2) البنود التي يُرجّح أنها ناقصة أو مبالغ فيها، مع رقم البند وسبب مختصر.
3) ما الذي يجب تجهيزه قبل رفع تعديل المقايسة للاستشاري.
اجعل كل نقطة سطرًا واحدًا يبدأ بـ «• ». لا تخترع أرقامًا غير موجودة. البيانات:
${JSON.stringify(data)}`, { max: 1800 });
    try {
      const files = (extraFiles ?? []);
      const id = await this.text(`أنت مدقق بيانات في إدارة مشاريع كهرباء. بيانات المشروع بالمنصة: أمر العمل ${p.wo}، الاسم "${p.name}"، الموقع "${p.site}".
والملفات المرفوعة: ${JSON.stringify(files)}
اكتب سطرين فقط بالعربية: الأول عن مدى تطابق أرقام أوامر العمل والأسماء بين المنصة والملفات، والثاني عن أي ملف يُشتبه أنه يخص مشروعًا آخر أو ينقص. ابدأ كل سطر بـ «• ». لا تكرر الأرقام كلها.`, { max: 500 });
      return (id ? id.trim() + "\n\n" : "") + base;
    } catch { return base; }
  }

  async ask(o: { question: string; history: { role: "user" | "assistant"; content: string }[]; context: unknown }): Promise<string> {
    const hist = [...o.history, { role: "user" as const, content: o.question }];
    hist[0] = { role: hist[0].role, content: "بيانات المحفظة (JSON):\n" + JSON.stringify(o.context) + "\n\nسؤال المستخدم: " + hist[0].content };
    return this.text(hist.map((h) => ({ role: h.role, content: h.content })), { system: AI_SYS, max: 1800 });
  }
}
export const createAi = (cfg: Config): AiService => new ClaudeService(cfg);
export { aiProjBrief, firmStats, derive };
