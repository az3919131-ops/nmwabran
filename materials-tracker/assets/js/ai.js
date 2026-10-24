/* القراءة الدقيقة بالذكاء الاصطناعي (Claude).
   ترسل الصورة أو ملف PDF أو النص من المتصفح مباشرة إلى Anthropic بمفتاح المستخدم نفسه.
   المفتاح يُحفظ في هذا المتصفح فقط ولا يمر بأي خادم آخر.
   الرد يأتي بمخطط JSON ملزِم (structured outputs) فلا يُحتاج إلى تخمين تنسيق النص.
   بعد القراءة تُفحص الصفوف (كود غير معروف، كمية ناقصة، مجموع فرعي لا يطابق)، وتُرسل المشكوك فيها إلى مراجعة ثانية. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const P = MT.Parsers;

  const API = 'https://api.anthropic.com/v1';
  const VERSION = '2026-10-21';
  const KEY = 'mt:ai-key';
  const MODEL = 'mt:ai-model2';
  const ON = 'mt:ai-on';
  const MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (الأدق، موصى به)', short: 'Claude Opus 5.5', price: [4, 20] },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (أسرع وأرخص)', short: 'Claude Sonnet 5.5', price: [2, 10] },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (الأرخص، للجداول الواضحة)', short: 'Claude Haiku 5.5', price: [0.1, 0.5] },
  ];
  const FALLBACK_MODEL = 'claude-sonnet-5-5';
  const MAX_TOKENS = 40000;
  const MAX_VERIFY_ROWS = 60;
  const MAX_PDF_BYTES = 24 * 1024 * 1024;

  const ls = {
    get: (k) => {
      try {
        return g.localStorage.getItem(k) || '';
      } catch (e) {
        return '';
      }
    },
    set: (k, v) => {
      try {
        if (v) g.localStorage.setItem(k, v);
        else g.localStorage.removeItem(k);
      } catch (e) {
        /* لا شيء */
      }
    },
  };

  class AIError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'AIError';
      this.code = code;
    }
  }

  /* ---------- المخططات ---------- */
  const str = { anyOf: [{ type: 'string' }, { type: 'null' }] };
  const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };
  const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
  const arr = (items) => ({ type: 'array', items });
  const ROW = {
    checklist: { material: str, description: str, uom: str, unloading_point: str, reservation: str, item_no: str, quantity: num },
    gatepass: { item_no: str, reservation: str, material: str, description: str, quantity: num, uom: str },
    uds: { material: str, description: str, quantity: num, uom: str, reference: str, reservation: str },
  };
  const SCHEMAS = {
    checklist: obj({ page: str, rows: arr(obj(ROW.checklist)), subtotals: arr(obj({ material: str, subtotal: num })) }),
    gatepass: obj({
      header: obj({ gate_pass_no: str, date: str, erp_delivery: str, material_doc: str, plant: str, storage_location: str, contractor: str }),
      rows: arr(obj(ROW.gatepass)),
      totals: arr(obj({ material: str, total: num })),
    }),
    uds: obj({ rows: arr(obj(ROW.uds)) }),
  };
  const verifySchema = (kind) => obj({ rows: arr(obj({ index: { type: 'integer' }, ...ROW[kind] })) });

  /* ---------- التعليمات ---------- */
  const SYSTEM =
    'You are a meticulous data-entry specialist for a warehouse in Saudi Arabia. You read scanned or photographed warehouse documents, PDFs, slides and pasted text, and copy their table rows exactly as printed. ' +
    'Accuracy matters more than speed: a wrong digit causes a wrong stock count. Copy digits exactly as printed. If a value is unreadable or absent, use null. Never guess, infer or invent values. ' +
    'Ignore handwritten ticks, strikes, stamps and signatures, but still read the printed value beneath them. Photos may be rotated or skewed: read them in their natural orientation. ' +
    'If the input has several pages, slides or screenshots, they belong to one document: return every row of every page in reading order.';

  const PROMPTS = {
    checklist:
      'This is a warehouse "Checklist" (delivery list) from Saudi Electricity (SEC). The table is grouped by material: each group has a 9-digit material number (starting with 9081) printed beside the group or in the Material column, then data rows, then a "Sub Total" line. ' +
      'For every data row return: material (the 9-digit number of its group), description, uom, unloading_point (format "W" + 12 digits + "/" + 4 digits, for example W264057918802/0002), reservation (10 digits starting with 00, for example 0030312223), item_no (4 digits), quantity (number). ' +
      'Also return subtotals: one entry per "Sub Total" line with its material and printed value, and page (for example "3 of 12") when printed. Before answering, check that the quantities of each material add up to its printed Sub Total; if they do not, look at those rows again.',
    gatepass:
      'This is an "SEC Gate Pass" (materials issued from the warehouse). Read the header: gate_pass_no (the 10-digit number printed under the barcode, for example 2000538783), date (from "Date & Time", format DD.MM.YYYY), erp_delivery, material_doc (digits only, drop the number in parentheses), plant, storage_location, contractor (name). ' +
      'Then read every table row: item_no (the "Item No" column), reservation (10 digits starting with 00), material (9 digits starting with 9081), description, quantity (QTY column), uom. If "Total" lines per material are printed, return them in totals and check your quantities against them.',
    uds:
      'This is a UDS material registration list. For every row return: material (9-digit number starting with 9081), description, quantity (number), uom, reference (the document or reference number of that registration, if any), reservation (10 digits starting with 00, if any).',
  };

  /* ---------- أدوات ---------- */
  async function b64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return g.btoa(s);
  }

  /**
   * يجهّز أجزاء الرسالة. inputs: عناصر من
   * { type: 'image', blob, rotate? } أو { type: 'pdf', blob } أو { type: 'text', text, label? }
   */
  async function buildParts(inputs) {
    const parts = [];
    for (const it of inputs) {
      if (it.type === 'image') {
        const jpeg = await MT.UI.imageToBlob(it.blob, { maxSide: 2400, quality: 0.9, rotate: it.rotate || 0 });
        parts.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await b64(jpeg) } });
      } else if (it.type === 'pdf') {
        if (it.blob.size > MAX_PDF_BYTES) throw new AIError('too_big', 'ملف PDF كبير على القراءة الذكية (الحد 24 ميجابايت). قسّمه إلى أجزاء أصغر.');
        parts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await b64(it.blob) } });
      } else if (it.type === 'text' && it.text && it.text.trim()) {
        parts.push({ type: 'text', text: `${it.label || 'Text of the document'}:\n${it.text.slice(0, 200000)}` });
      }
    }
    if (!parts.length) throw new AIError('empty', 'لا يوجد محتوى لإرساله.');
    // تُحفظ الوسائط في ذاكرة التخزين المؤقت لتُعاد المراجعة الثانية بتكلفة أقل
    const media = parts.map((p, i) => (p.type === 'image' || p.type === 'document' ? i : -1)).filter((i) => i >= 0);
    if (media.length) parts[media[media.length - 1]].cache_control = { type: 'ephemeral' };
    return parts;
  }

  function buildBody({ kind, parts, model, prompt, schema, effort = 'high' }) {
    return {
      model,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: SYSTEM,
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: [...parts, { type: 'text', text: prompt }] }],
    };
  }

  const headers = (key) => ({
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  });

  /** يحوّل رد خطأ HTTP إلى AIError برسالة عربية واضحة */
  async function httpError(res) {
    let type = '';
    let msg = '';
    try {
      const j = await res.json();
      type = (j.error && j.error.type) || '';
      msg = (j.error && j.error.message) || '';
    } catch (e) {
      /* لا شيء */
    }
    const s = res.status;
    let e;
    if (s === 401) e = new AIError('auth', 'مفتاح API غير صالح. راجع الإعدادات.');
    else if (s === 403) e = new AIError('auth', 'هذا المفتاح لا يملك صلاحية القراءة الذكية. راجع الإعدادات.');
    else if (s === 404) e = new AIError('model', 'النموذج المختار غير متاح لهذا المفتاح. اختر نموذجًا آخر من الإعدادات.');
    else if (s === 413) e = new AIError('too_big', 'الملف كبير على القراءة الذكية. قسّمه إلى أجزاء أصغر.');
    else if (s === 429) e = new AIError('rate', 'تجاوزت حد الطلبات. انتظر قليلًا ثم أعد المحاولة.');
    else if (s >= 500 || type === 'overloaded_error') e = new AIError('overloaded', 'خدمة Claude مشغولة الآن. أعد المحاولة بعد لحظات.');
    else if (/credit balance|billing/i.test(msg)) e = new AIError('credit', 'رصيد حساب Anthropic لا يكفي. أضف رصيدًا من console.anthropic.com ثم أعد المحاولة.');
    else e = new AIError('bad_request', `رفضت الخدمة الطلب (${s}). ${msg}`.trim());
    e.status = s;
    e.detail = msg;
    return e;
  }

  /** يقرأ تيار SSE ويعيد { text, stop, usage }. onText يُستدعى بالنص المتراكم. */
  async function readStream(res, onText) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let text = '';
    let stop = null;
    let details = null;
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const take = (raw) => {
      let data = '';
      for (const line of raw.split('\n')) if (line.startsWith('data:')) data += line.slice(5).trim();
      if (!data) return;
      let ev;
      try {
        ev = JSON.parse(data);
      } catch (e) {
        return;
      }
      if (ev.type === 'message_start' && ev.message && ev.message.usage) {
        const u = ev.message.usage;
        usage.input += u.input_tokens || 0;
        usage.cacheRead += u.cache_read_input_tokens || 0;
        usage.cacheWrite += u.cache_creation_input_tokens || 0;
      } else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        text += ev.delta.text;
        if (onText) onText(text);
      } else if (ev.type === 'message_delta') {
        if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        if (ev.delta && ev.delta.stop_details) details = ev.delta.stop_details;
        if (ev.usage && ev.usage.output_tokens) usage.output = ev.usage.output_tokens;
      } else if (ev.type === 'error') {
        const t = (ev.error && ev.error.type) || '';
        throw new AIError(t === 'overloaded_error' ? 'overloaded' : 'bad_request', t === 'overloaded_error' ? 'خدمة Claude مشغولة الآن. أعد المحاولة بعد لحظات.' : `انقطعت القراءة الذكية: ${(ev.error && ev.error.message) || ''}`);
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        take(buf.slice(0, i));
        buf = buf.slice(i + 2);
      }
    }
    if (buf.trim()) take(buf);
    return { text, stop, details, usage };
  }

  const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', () => (clearTimeout(t), reject(new AIError('aborted', 'أُلغيت القراءة.'))), { once: true });
    });

  /** طلب واحد مع إعادة محاولة عند ازدحام الخدمة أو تجاوز الحد */
  async function call(opts, { signal, onText } = {}) {
    const key = AI.getKey();
    const body = JSON.stringify(buildBody(opts));
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal && signal.aborted) throw new AIError('aborted', 'أُلغيت القراءة.');
      try {
        let res;
        try {
          res = await fetch(`${API}/messages`, { method: 'POST', headers: headers(key), body, signal });
        } catch (e) {
          if (e && e.name === 'AbortError') throw new AIError('aborted', 'أُلغيت القراءة.');
          throw new AIError('network', 'تعذّر الاتصال بخدمة Claude. تأكد من الإنترنت ثم أعد المحاولة.');
        }
        if (!res.ok) throw await httpError(res);
        const out = await readStream(res, onText);
        if (out.stop === 'refusal') throw new AIError('refusal', 'رفض Claude قراءة هذا المحتوى. جرّب صورة أوضح أو اقرأه محليًا.');
        if (out.stop === 'max_tokens') throw new AIError('too_long', 'المستند أطول من أن يُقرأ دفعة واحدة. قسّمه إلى صفحات أقل.');
        let json;
        try {
          json = JSON.parse(out.text);
        } catch (e) {
          const a = out.text.indexOf('{');
          const b = out.text.lastIndexOf('}');
          try {
            json = JSON.parse(out.text.slice(a, b + 1));
          } catch (e2) {
            throw new AIError('parse', 'لم أستطع فهم رد القراءة الذكية. أعد المحاولة.');
          }
        }
        return { json, usage: out.usage };
      } catch (e) {
        lastErr = e;
        if (!(e instanceof AIError) || !['overloaded', 'rate', 'network'].includes(e.code) || attempt === 2) throw e;
        await sleep(AI._retry[attempt] || 6000, signal);
      }
    }
    throw lastErr;
  }

  /* ---------- الفحص والمراجعة الثانية ---------- */
  const PROBLEMS = {
    code_missing: 'the material code is missing',
    code_unknown: 'the material code is not in the company catalog (probably a misread digit)',
    qty_missing: 'the quantity is missing',
    sub_mismatch: 'the quantities of this material do not add up to the printed subtotal or total',
  };
  const issueOf = (r) => (r.flags || []).filter((f) => PROBLEMS[f]);
  const countIssues = (rows) => rows.filter((r) => issueOf(r).length).length;

  function merge(raw, fixed) {
    const out = JSON.parse(JSON.stringify(raw));
    for (const f of fixed.rows || []) {
      const i = f.index;
      if (!Number.isInteger(i) || !out.rows[i]) continue;
      for (const [k, v] of Object.entries(f)) if (k !== 'index' && v != null) out.rows[i][k] = v;
    }
    return out;
  }

  function addUsage(a, b) {
    return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };
  }
  function cost(usage, model) {
    const m = MODELS.find((x) => x.id === model) || MODELS[0];
    return (usage.input * m.price[0] + usage.cacheWrite * m.price[0] * 1.25 + usage.cacheRead * m.price[0] * 0.1 + usage.output * m.price[1]) / 1e6;
  }

  /**
   * القراءة الكاملة: طلب استخراج ثم مراجعة ثانية للصفوف المشكوك فيها.
   * يعيد { parsed, usage, cost, model, verified, note }.
   */
  async function read(kind, inputs, { ctx = {}, onStatus, signal, verify = true } = {}) {
    if (!AI.hasKey()) throw new AIError('nokey', 'أضف مفتاح API من الإعدادات أولًا.');
    const say = (pct, text) => onStatus && onStatus({ pct, text });
    say(6, 'تجهيز الملف للإرسال...');
    const parts = await buildParts(inputs);
    let model = AI.getModel();
    const notes = [];
    let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const rowsSoFar = (t) => (t.match(/"material"\s*:/g) || []).length;
    const run = async (m, prompt, schema, lo, hi) => {
      const mi = MODELS.find((x) => x.id === m);
      say(lo, `قراءة دقيقة بـ ${mi ? mi.short : m}...`);
      return call({ kind, parts, model: m, prompt, schema }, { signal, onText: (t) => say(Math.min(hi, lo + Math.round(rowsSoFar(t) * 1.2)), `قراءة دقيقة... وصلت إلى ${U.fmt(rowsSoFar(t), 0)} صفًا`) });
    };

    let first;
    try {
      first = await run(model, PROMPTS[kind], SCHEMAS[kind], 12, 70);
    } catch (e) {
      if (e.code === 'model' && model !== FALLBACK_MODEL) {
        notes.push(`النموذج ${model} غير متاح لهذا المفتاح، فقُرئ الملف بـ ${FALLBACK_MODEL}.`);
        model = FALLBACK_MODEL;
        first = await run(model, PROMPTS[kind], SCHEMAS[kind], 12, 70);
      } else throw e;
    }
    usage = addUsage(usage, first.usage);
    let raw = first.json;
    let parsed = P.fromAI(kind, raw, ctx);
    let verified = 0;

    const bad = parsed.rows.map((r, i) => ({ r, i })).filter((x) => issueOf(x.r).length);
    if (verify && bad.length && bad.length <= MAX_VERIFY_ROWS) {
      say(76, `مراجعة ثانية لـ ${bad.length} صفًا مشكوكًا فيه...`);
      const list = bad.map(({ r, i }) => ({ index: i, material: (raw.rows[i] || {}).material, reservation: (raw.rows[i] || {}).reservation, quantity: (raw.rows[i] || {}).quantity, problem: issueOf(r).map((f) => PROBLEMS[f]).join('; ') }));
      const prompt =
        'An automatic check found problems in some rows you extracted from this same document. ' +
        'Look at the document again, find exactly these rows, and read their values digit by digit. Return ONLY these rows, each with its index, corrected where you can read the right value, and null where the document is truly unreadable.\n' +
        JSON.stringify(list);
      try {
        const second = await call({ kind, parts, model, prompt, schema: verifySchema(kind) }, { signal });
        usage = addUsage(usage, second.usage);
        const merged = merge(raw, second.json);
        const parsed2 = P.fromAI(kind, merged, ctx);
        if (countIssues(parsed2.rows) < countIssues(parsed.rows)) {
          verified = bad.length;
          raw = merged;
          parsed = parsed2;
        }
      } catch (e) {
        if (e.code === 'aborted') throw e;
        notes.push('تعذّرت المراجعة الثانية، فبقيت نتيجة القراءة الأولى.');
      }
    }
    parsed.warnings = [...(parsed.warnings || []), ...notes];
    say(98, 'تحليل الصفوف...');
    return { parsed, usage, cost: cost(usage, model), model, verified };
  }

  /** فحص المفتاح والنموذج بدون تكلفة (قراءة بيانات النموذج فقط) */
  async function test(key = AI.getKey(), model = AI.getModel()) {
    if (!key) throw new AIError('nokey', 'اكتب المفتاح أولًا.');
    let res;
    try {
      res = await fetch(`${API}/models/${encodeURIComponent(model)}`, { headers: headers(key) });
    } catch (e) {
      throw new AIError('network', 'تعذّر الاتصال بخدمة Claude. تأكد من الإنترنت.');
    }
    if (!res.ok) throw await httpError(res);
    return true;
  }

  const AI = (MT.AI = {
    MODELS,
    PROMPTS,
    SCHEMAS,
    AIError,
    getKey: () => ls.get(KEY),
    setKey: (v) => ls.set(KEY, (v || '').trim()),
    getModel: () => ls.get(MODEL) || MODELS[0].id,
    setModel: (v) => ls.set(MODEL, v),
    hasKey: () => !!ls.get(KEY),
    /** تفضيل المستخدم: القراءة الذكية مفعّلة افتراضيًا ما دام المفتاح موجودًا */
    isEnabled: () => ls.get(KEY) !== '' && ls.get(ON) !== '0',
    setEnabled: (on) => ls.set(ON, on ? '' : '0'),
    label: (id) => (MODELS.find((m) => m.id === id) || { short: id }).short,
    read,
    test,
    cost,
    _retry: [2500, 6000],
    _t: { buildBody, readStream, merge, buildParts, verifySchema, issueOf },
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
