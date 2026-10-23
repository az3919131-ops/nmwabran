/* القراءة الذكية (اختيارية): ترسل الصورة إلى Claude مباشرة من المتصفح بمفتاح المستخدم.
   المفتاح يُحفظ في هذا المتصفح فقط، ولا يمر بأي خادم آخر. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const P = MT.Parsers;

  const KEY = 'mt:ai-key';
  const MODEL = 'mt:ai-model';
  const MODELS = [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (موصى به)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (أدق وأبطأ)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (أسرع وأرخص)' },
  ];
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

  const COMMON = 'Copy digits exactly as printed. If a value is unreadable, use null. Never guess or invent values. Ignore handwritten ticks, strikes and signatures, but read the printed value beneath them. The photo may be rotated or skewed: read it in its natural orientation. Reply with one JSON object only, no prose and no code fences.';
  const PROMPTS = {
    checklist: `This is a photo of a warehouse "Checklist" (delivery list) page from Saudi Electricity (SEC). The table is grouped by material: each group has a large 9-digit material number (starting with 9081) printed in the margin beside the group, then data rows, then a "Sub Total" line. For every data row return: material (the 9-digit number of its group), description, uom, unloading_point (format "W" + 12 digits + "/" + 4 digits, example W264057918802/0002), reservation (10 digits starting with 00, example 0030312223), item_no (4 digits), quantity (number). Also return subtotals: [{"material": "...", "subtotal": N}] from the "Sub Total" lines, and page (example "3 of 12").\nJSON shape: {"page": "...", "rows": [{"material": "", "description": "", "uom": "", "unloading_point": "", "reservation": "", "item_no": "", "quantity": 0}], "subtotals": [{"material": "", "subtotal": 0}]}\n${COMMON}`,
    gatepass: `This is a photo of a "SEC Gate Pass" page (materials issued from the warehouse). Read the header: gate_pass_no (the 10-digit number printed under the barcode, example 2000538783), date (from "Date & Time", format DD.MM.YYYY), erp_delivery, material_doc (digits only, drop the number in parentheses), plant, storage_location, contractor (name). Then read every table row: item_no (the "Item No" column), reservation (10 digits starting with 00), material (9 digits starting with 9081), description, quantity (QTY column), uom. If "Total" lines per material are printed, return them in totals.\nJSON shape: {"header": {"gate_pass_no": "", "date": "", "erp_delivery": "", "material_doc": "", "plant": "", "storage_location": "", "contractor": ""}, "rows": [{"item_no": "", "reservation": "", "material": "", "description": "", "quantity": 0, "uom": ""}], "totals": [{"material": "", "total": 0}]}\n${COMMON}`,
    uds: `This is a photo or screenshot of a UDS material registration list. For every row return: material (9-digit number starting with 9081), description, quantity (number), uom, reference (document or reference number of that registration, if any), reservation (10 digits starting with 00, if any).\nJSON shape: {"rows": [{"material": "", "description": "", "quantity": 0, "uom": "", "reference": "", "reservation": ""}]}\n${COMMON}`,
  };

  function b64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('تعذّر قراءة الصورة'));
      r.readAsDataURL(blob);
    });
  }

  async function read(kind, blob, { rotation = 0, ctx = {} } = {}) {
    const key = AI.getKey();
    if (!key) throw new Error('أضف مفتاح API من الإعدادات أولًا.');
    const jpeg = await MT.UI.imageToBlob(blob, { maxSide: 2000, quality: 0.88, rotate: rotation === 'auto' ? 0 : rotation });
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: AI.getModel(),
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await b64(jpeg) } },
                { type: 'text', text: PROMPTS[kind] },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      throw new Error('تعذّر الاتصال بخدمة القراءة الذكية. تأكد من الإنترنت.');
    }
    if (!res.ok) {
      let msg = '';
      try {
        msg = (await res.json()).error.message;
      } catch (e) {
        /* لا شيء */
      }
      if (res.status === 401) throw new Error('مفتاح API غير صالح. راجع الإعدادات.');
      if (res.status === 429) throw new Error('تجاوزت حد الطلبات. انتظر قليلًا ثم أعد المحاولة.');
      throw new Error(`فشلت القراءة الذكية (${res.status}). ${msg}`);
    }
    const out = await res.json();
    const text = (out.content || []).map((c) => c.text || '').join('');
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    let json;
    try {
      json = JSON.parse(text.slice(a, b + 1));
    } catch (e) {
      throw new Error('لم أستطع فهم رد القراءة الذكية. أعد المحاولة.');
    }
    return P.fromAI(kind, json, ctx);
  }

  const AI = (MT.AI = {
    MODELS,
    PROMPTS,
    getKey: () => ls.get(KEY),
    setKey: (v) => ls.set(KEY, (v || '').trim()),
    getModel: () => ls.get(MODEL) || MODELS[0].id,
    setModel: (v) => ls.set(MODEL, v),
    hasKey: () => !!ls.get(KEY),
    read,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
