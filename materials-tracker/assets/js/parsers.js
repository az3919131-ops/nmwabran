/* محللات المستندات: تحويل نص OCR (أو صفوف جدول Excel) إلى صفوف منظّمة.
   كل صف قد يحمل flags تشرح ما يحتاج مراجعة. دوال نقية تعمل في المتصفح وNode. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const C = MT.Catalog;

  /* ---------- أنماط ---------- */
  const LOOK = { O: '0', o: '0', I: '1', l: '1', '|': '1', S: '5', B: '8', Z: '2', D: '0' };
  const RE_RES = /(?:^|\D)(00\d{8})(?!\d)/g;
  const RE_CODE9 = /(?:^|\D)(\d{9})(?!\d)/g;
  const RE_UNLOAD = /W\s?(\d{9,13})\s*[/\\|]\s*(\d{3,4})/i;
  const RE_UNLOAD_LOOSE = /(?:^|\D)(\d{12})\s*[/\\]\s*(\d{3,4})(?!\d)/;
  const RE_SUB = /sub\s*to[a-z]{2,3}\b\D{0,6}(\d+)\s*$/i;
  const RE_HEAD = /material\s*desc|e\s*mat\s*gr|unloading\s*p/i;
  const RE_UOM = /\b(KIT|EA|PC|PCS|KM|M|R|DRUM|ST|SET|LOT)\b/i;

  const clean = (t) =>
    U.digits(t)
      .replace(/[‎‏‪-‮]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  /** يصحح التباسات الحروف داخل الرموز الرقمية الطويلة فقط */
  function fixDigits(text) {
    return text
      .split(' ')
      .map((tok) => {
        const d = (tok.match(/\d/g) || []).length;
        if (tok.length >= 8 && d / tok.length >= 0.7 && !/^W/i.test(tok)) return tok.replace(/[OoIl|SBZD]/g, (c) => LOOK[c]);
        return tok;
      })
      .join(' ');
  }

  function scan(re, text) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      out.push({ v: m[1], i: m.index + m[0].indexOf(m[1]) });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  /** يوحّد مخرجات OCR إلى مصفوفة أسطر مرتبة */
  function normLines(ocr) {
    let lines = [];
    if (ocr && Array.isArray(ocr.lines) && ocr.lines.length) {
      lines = ocr.lines.map((l) => ({
        text: String(l.text || '').replace(/\n/g, ' '),
        y0: l.bbox ? l.bbox.y0 : 0,
        y1: l.bbox ? l.bbox.y1 : 0,
        x0: l.bbox ? l.bbox.x0 : 0,
        conf: l.confidence,
      }));
    } else {
      const txt = typeof ocr === 'string' ? ocr : (ocr && ocr.text) || '';
      lines = txt.split(/\n+/).map((t, i) => ({ text: t, y0: i * 10, y1: i * 10 + 9, x0: 0 }));
    }
    lines = lines.map((l) => ({ ...l, text: fixDigits(clean(l.text)) })).filter((l) => l.text);
    return lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  }

  /** يحوّل رمزًا من 9 أرقام إلى كود كتالوج، مع تصحيح خانة واحدة عند وجود مرشح وحيد */
  function resolveCode(tok) {
    if (!tok) return null;
    if (C.get(tok)) return { code: tok, how: 'exact' };
    const near = C.nearest(tok, 1);
    if (near.length === 1) return { code: near[0].code, how: 'fixed', from: tok };
    return null;
  }

  /* ---------- Checklist ---------- */
  function parseChecklistRow(t) {
    const u = t.match(RE_UNLOAD) || t.match(RE_UNLOAD_LOOSE);
    if (!u) return null;
    const digits = u[1];
    const itemSuffix = u[2].padStart(4, '0');
    const wo = digits.length >= 12 ? digits.slice(0, 9) : digits;
    const type = digits.length >= 12 ? digits.slice(9, 12) : '';
    const at = t.indexOf(u[0]);
    const before = t.slice(0, at);
    const after = t.slice(at + u[0].length);
    const resHit = scan(RE_RES, after)[0] || scan(RE_RES, t)[0];
    const row = {
      qty: null,
      reservation: resHit ? resHit.v : '',
      item_no: itemSuffix,
      work_order: wo,
      wo_type: type,
      unloading_point: 'W' + digits + '/' + itemSuffix,
      doc_desc: '',
      uom: '',
      flags: [],
    };
    const uom = before.match(RE_UOM);
    if (uom) row.uom = uom[1].toUpperCase();

    const inlineCode = scan(RE_CODE9, before)[0];
    row._inlineCode = inlineCode ? inlineCode.v : '';

    // الكمية: آخر رقم بعد الحجز بعد استبعاد عمود رقم البند (حتى لو قُرئ بخطأ خانة)
    const rest = resHit ? after.slice(after.indexOf(resHit.v) + resHit.v.length) : after;
    const isItem = (n) => n.length >= 3 && U.lev(n.padStart(4, '0'), itemSuffix, 1) <= 1;
    const nums = (rest.match(/\b\d{1,4}\b/g) || []).filter((n) => !isItem(n));
    if (nums.length) {
      const n = parseInt(nums[nums.length - 1], 10);
      if (n > 0) row.qty = n;
    }

    row.doc_desc = before
      .replace(/[|=\[\]{}~©«»]+/g, ' ')
      .replace(/\b(9|0)\d{8}\b/g, ' ')
      .replace(/\bDIST\b/gi, ' ')
      .replace(/\b(KIT|EA)\b(\s+\S{1,3}){0,2}\s*$/i, ' ')
      .replace(/^\s*\d{1,3}\s+/, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return row;
  }

  function parseChecklist(ocr, ctx = {}) {
    const lines = normLines(ocr);
    const groups = [];
    let cur = null;
    const open = (y) => {
      if (!cur) {
        cur = { rows: [], labels: [], descs: [], y0: y, subtotal: null };
        groups.push(cur);
      }
      return cur;
    };
    const close = () => {
      cur = null;
    };

    for (const l of lines) {
      const t = l.text;
      if (t.length < 32 && /sub\s*to[a-z]{1,4}\b/i.test(t)) {
        const sub = t.match(RE_SUB);
        if (cur) cur.subtotal = sub ? parseInt(sub[1], 10) : null;
        close();
        continue;
      }
      const row = parseChecklistRow(t);
      if (row) {
        const gp = open(l.y0);
        row.y = l.y0;
        gp.rows.push(row);
        if (row._inlineCode) {
          const rc = resolveCode(row._inlineCode);
          if (rc) gp.labels.push(rc);
        }
        if (row.doc_desc) gp.descs.push(row.doc_desc);
        continue;
      }
      if (RE_HEAD.test(t) && !/\d{9}/.test(t)) {
        if (cur && cur.rows.length) close();
        open(l.y0);
        continue;
      }
      // سطر منفرد قد يحمل رقم المادة الجانبي
      const codes = scan(RE_CODE9, t).map((c) => resolveCode(c.v)).filter(Boolean);
      if (codes.length) open(l.y0).labels.push(codes[0]);
    }

    const withRows = groups.filter((gp) => gp.rows.length);

    // 1) كود المجموعة من الأرقام الجانبية
    withRows.forEach((gp) => {
      if (gp.labels.length) {
        const exact = gp.labels.find((x) => x.how === 'exact');
        gp.code = (exact || gp.labels[0]).code;
        gp.how = exact ? 'label' : 'fixed';
      }
    });
    // 2) استنتاج الأكواد الناقصة من الوصف بين كودين متجاورين (القوائم مرتبة تصاعديًا).
    //    لا يُعيَّن كود إلا إذا كان الأقرب وحيدًا بوضوح، وإلا تُعرض اقتراحات للمستخدم.
    withRows.forEach((gp, i) => {
      if (gp.code) return;
      const lo = (withRows.slice(0, i).reverse().find((x) => x.code) || {}).code;
      const hi = (withRows.slice(i + 1).find((x) => x.code) || {}).code;
      const desc = gp.descs.sort((a, b) => b.length - a.length)[0] || '';
      const res = desc ? C.byDesc(desc, lo, hi) : { best: null, candidates: [] };
      if (res.best) {
        gp.code = res.best.code;
        gp.how = 'desc';
      } else {
        gp.suggestions = res.candidates;
      }
    });

    // 3) أمر العمل لكل حجز بالأغلبية (مع أفضلية لبادئة السنة السائدة في المستند)، ثم الحجز لكل أمر عمل
    const allWo = withRows.flatMap((gp) => gp.rows.map((r) => r.work_order)).filter(Boolean);
    const prefixCount = new Map();
    allWo.forEach((w) => prefixCount.set(w.slice(0, 2), (prefixCount.get(w.slice(0, 2)) || 0) + 1));
    const docPrefix = ([...prefixCount.entries()].sort((a, b) => b[1] - a[1])[0] || [''])[0];
    const resVotes = new Map();
    const woVotes = new Map();
    withRows.forEach((gp) =>
      gp.rows.forEach((r) => {
        if (r.reservation) {
          const v = resVotes.get(r.reservation) || new Map();
          v.set(r.work_order, (v.get(r.work_order) || 0) + 1 + (r.work_order.startsWith(docPrefix) ? 0.5 : 0));
          resVotes.set(r.reservation, v);
        }
        if (r.work_order) {
          const v = woVotes.get(r.work_order) || new Map();
          if (r.reservation) v.set(r.reservation, (v.get(r.reservation) || 0) + 1);
          woVotes.set(r.work_order, v);
        }
      })
    );
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const woByRes = new Map([...resVotes].map(([res, v]) => [res, top(v)[0]]));
    const resByWo = new Map([...woVotes].filter(([, v]) => v.size).map(([wo, v]) => [wo, top(v)[0]]));

    const rows = [];
    const warnings = [];
    withRows.forEach((gp, gi) => {
      gp.rows.forEach((r) => {
        r.code = gp.code || '';
        r.group = gi + 1;
        if (gp.how === 'fixed') r.flags.push('code_fixed');
        if (gp.how === 'desc') r.flags.push('code_inferred');
        if (!r.code) {
          r.flags.push('code_missing');
          if (gp.suggestions && gp.suggestions.length) r.suggestions = gp.suggestions;
        }
        if (r.reservation && woByRes.has(r.reservation) && woByRes.get(r.reservation) !== r.work_order) {
          r.work_order = woByRes.get(r.reservation);
          r.unloading_point = 'W' + r.work_order + r.wo_type + '/' + r.item_no;
          r.flags.push('wo_fixed');
        }
        if (!r.reservation && resByWo.has(r.work_order)) {
          r.reservation = resByWo.get(r.work_order);
          r.flags.push('res_inferred');
        }
        if (!r.reservation) r.flags.push('res_missing');
      });
      // 4) المجموع الفرعي: يكمل كمية ناقصة واحدة ويكشف عدم التطابق
      const known = U.sum(gp.rows.filter((r) => r.qty != null), (r) => r.qty);
      const missing = gp.rows.filter((r) => r.qty == null);
      if (gp.subtotal != null) {
        if (missing.length === 1 && gp.subtotal - known > 0) {
          missing[0].qty = gp.subtotal - known;
          missing[0].flags.push('qty_inferred');
        } else if (!missing.length && known !== gp.subtotal) {
          warnings.push(`المجموع الفرعي المطبوع للمجموعة ${gi + 1} هو ${gp.subtotal} بينما مجموع الصفوف المقروءة ${known}`);
          if (known < gp.subtotal) {
            // غالبًا صف لم يُقرأ: نضيف صفًا بديلًا بالفرق ليكمله المستخدم
            gp.rows.push({ qty: gp.subtotal - known, reservation: '', item_no: '', work_order: '', wo_type: '', unloading_point: '', doc_desc: '', uom: '', flags: ['row_missing'], code: gp.code || '', y: (gp.rows[gp.rows.length - 1].y || 0) + 1, placeholder: true });
          } else gp.rows.forEach((r) => r.flags.push('sub_mismatch'));
        }
      }
      gp.rows.forEach((r) => {
        if (r.qty == null) r.flags.push('qty_missing');
        if (r.placeholder) {
          r.group = gi + 1;
          if (!r.code) r.flags.push('code_missing');
          delete r.placeholder;
        }
        delete r._inlineCode;
        rows.push(r);
      });
    });
    return { kind: 'checklist', rows: finalize('checklist', rows, ctx), warnings, groups: withRows.length };
  }

  /* ---------- Gate Pass ---------- */
  const LOOK_ONE = /^[Il|!iL1]$/;

  function parseGateHeader(lines) {
    const h = { no: '', date: null, erp_delivery: '', material_doc: '', plant: '', storage: '', contractor: '' };
    const all = lines.map((l) => l.text);
    for (const t of all) {
      if (!h.date && /date|time|\d{1,2}[./]\d{1,2}[./]20\d{2}/i.test(t)) h.date = U.parseDate(t);
      if (!h.no) {
        const n = scan(/(?:^|\D)(20\d{8})(?!\d)/g, t)[0];
        if (n) h.no = n.v;
      }
      let m;
      if (!h.erp_delivery && (m = t.match(/ERP\s*Delivery\D{0,4}(\d{6,10})/i))) h.erp_delivery = m[1];
      if (!h.material_doc && (m = t.match(/Material\s*Doc\D{0,4}(\d{8,10})/i))) h.material_doc = m[1];
      if (!h.plant && (m = t.match(/Plant\D{0,4}(\d{4})/i))) h.plant = m[1];
      if (!h.storage && (m = t.match(/Storage\s*Loc\w*\D{0,4}(\d{3,4})/i))) h.storage = m[1];
      if (!h.contractor && (m = t.match(/User\s*Name\s+(.{4,60})$/i))) h.contractor = m[1].replace(/[&|]+\s*$/, '').trim();
    }
    return h;
  }

  function parseGateLines(lines) {
    const out = [];
    let last = null;
    for (const l of lines) {
      const t = l.text;
      if (/^\W*total\b/i.test(t) || /\btotal\s+\d/i.test(t)) {
        const m = t.match(/total\D{0,4}(\d+)/i);
        if (last && m) last.total = parseInt(m[1], 10);
        continue;
      }
      const resHits = scan(RE_RES, t);
      const codeHits = scan(RE_CODE9, t).map((c) => ({ ...c, rc: resolveCode(c.v) })).filter((c) => c.rc || /^9081/.test(c.v));
      if (!resHits.length && !codeHits.length) {
        // سطر تكميلي للكمية: مثل "COLD SHRINK 01 1 KIT"
        if (last && last.qty == null) {
          const q = t.match(/\b01\b\s+(\S+)\s+(KIT|EA|M|KM|R|DRUM|PC|ST)\b/i);
          if (q) setQty(last, q[1]);
        }
        continue;
      }
      const res = resHits[0] ? resHits[0].v : '';
      const code = codeHits[0] ? codeHits[0].rc || { code: codeHits[0].v, how: 'raw' } : null;
      const resAt = resHits[0] ? resHits[0].i : -1;
      const lead = resAt > 0 ? t.slice(0, resAt) : '';
      const toks = (lead.match(/\b\d{1,4}\b/g) || []).map(Number);
      const lineNo = [...toks].reverse().find((n) => n >= 10 && n % 10 === 0) || null;

      const afterCodeAt = codeHits[0] ? codeHits[0].i + 9 : resAt >= 0 ? resAt + 10 : 0;
      const tail = t.slice(afterCodeAt);
      const row = {
        line_no: lineNo ? String(lineNo) : '',
        reservation: res,
        code: code ? code.code : '',
        qty: null,
        uom: '',
        doc_desc: '',
        flags: [],
        y: l.y0,
      };
      if (code && code.how === 'fixed') row.flags.push('code_fixed');
      const uom = tail.match(RE_UOM);
      if (uom) row.uom = uom[1].toUpperCase();
      // الكمية: أول رمز بعد عمود MT (01)
      const mt = tail.match(/(?:^|\s)[|]?(?:101|01|O1)\b\s*(\S+)?/);
      if (mt && mt[1]) setQty(row, mt[1]);
      const descPart = tail.split(/\s(?:\|?01|101)\b/)[0] || tail;
      row.doc_desc = descPart.replace(/[|=\[\]{}~©]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (row.doc_desc.length < 6) row.doc_desc = '';
      out.push(row);
      last = row;
    }
    return out;
  }

  function setQty(row, tok) {
    if (/^\d{1,4}$/.test(tok)) {
      row.qty = parseInt(tok, 10);
    } else if (LOOK_ONE.test(tok)) {
      row.flags.push('qty_unclear');
    }
  }

  function parseGatePass(ocr, ctx = {}) {
    const lines = Array.isArray(ocr) ? ocr : normLines(ocr);
    const header = parseGateHeader(lines);
    const rows = parseGateLines(lines);
    return { kind: 'gatepass', header, rows: finalize('gatepass', rows, ctx), warnings: [] };
  }

  /** يدمج الصفوف المتجزئة (من تمريرتين أو من أسطر متجاورة) اعتمادًا على تقارب الموضع الرأسي وتكامل الحقول */
  const conflict = (a, b) => a != null && a !== '' && b != null && b !== '' && a !== b;
  const compatible = (x, y) => Math.abs((x.y || 0) - (y.y || 0)) < 60 && !conflict(x.reservation, y.reservation) && !conflict(x.code, y.code) && !conflict(x.line_no, y.line_no);
  function coalesce(rows) {
    const sorted = rows.map((r) => ({ ...r, flags: [...(r.flags || [])] })).sort((a, b) => (a.y || 0) - (b.y || 0));
    const out = [];
    for (const r of sorted) {
      const prev = out[out.length - 1];
      if (prev && compatible(prev, r)) {
        ['code', 'line_no', 'reservation', 'uom', 'doc_desc'].forEach((k) => {
          if (!prev[k] && r[k]) prev[k] = r[k];
        });
        if (prev.qty == null && r.qty != null) prev.qty = r.qty;
        else if (prev.qty != null && r.qty != null && prev.qty !== r.qty) prev.flags.push('qty_conflict');
        r.flags.forEach((f) => !prev.flags.includes(f) && prev.flags.push(f));
      } else out.push(r);
    }
    return out;
  }

  /** يدمج نتيجتين لنفس الصورة (تمريرتان) ثم يستنتج الكود الناقص من الجيران ومن الـ Checklist */
  function mergeGatePass(a, b, ctx = {}) {
    const header = { ...(b ? b.header : {}) };
    Object.keys(a.header).forEach((k) => {
      if (a.header[k]) header[k] = a.header[k];
    });
    let rows = coalesce([...a.rows.map(stripFinal), ...(b ? b.rows.map(stripFinal) : [])]);
    // الصفوف مرتبة بالكود تصاعديًا: إن تساوى كود الجارين فهو كود الصف
    rows.forEach((r, i) => {
      if (r.code) return;
      const prev = rows.slice(0, i).reverse().find((x) => x.code);
      const next = rows.slice(i + 1).find((x) => x.code);
      if (prev && next && prev.code === next.code) {
        r.code = prev.code;
        r.flags.push('code_inferred');
      }
    });
    // أو من الـ Checklist إذا كان الحجز يخص مادة واحدة فقط
    if (ctx.resCodes) {
      rows.forEach((r) => {
        if (r.code || !r.reservation) return;
        const set = ctx.resCodes[r.reservation];
        if (set && set.length === 1) {
          r.code = set[0];
          r.flags.push('code_inferred');
        }
      });
    }
    return { kind: 'gatepass', header, rows: finalize('gatepass', rows, ctx), warnings: [] };
  }
  const stripFinal = (r) => {
    const o = { ...r };
    o.flags = (o.flags || []).filter((f) => !['code_unknown', 'code_missing', 'qty_missing', 'qty_unclear', 'res_unknown'].includes(f));
    return o;
  };

  /* ---------- UDS ---------- */
  function parseUds(ocr, ctx = {}) {
    const lines = normLines(ocr);
    const rows = [];
    for (const l of lines) {
      const t = l.text;
      const codes = scan(RE_CODE9, t).map((c) => ({ ...c, rc: resolveCode(c.v) })).filter((c) => c.rc || /^9081/.test(c.v));
      if (!codes.length) continue;
      const c = codes[0];
      const after = t.slice(c.i + 9);
      const res = scan(RE_RES, t)[0];
      const refM = t.match(/\b(UDS[-\s]?[A-Z0-9-]{3,})\b/i) || after.match(/\b(\d{8,12})\b/);
      const nums = (after.replace(res ? res.v : '', ' ').match(/\b\d+(?:\.\d+)?\b/g) || []).filter((n) => !(refM && n === refM[1]));
      const row = {
        code: c.rc ? c.rc.code : c.v,
        qty: null,
        reference: refM ? refM[1].toUpperCase() : '',
        reservation: res ? res.v : '',
        doc_desc: after.replace(/[|=\[\]{}~©]+/g, ' ').replace(/\b\d[\d.]*\b/g, ' ').replace(/\s+/g, ' ').trim(),
        flags: [],
        y: l.y0,
      };
      if (c.rc && c.rc.how === 'fixed') row.flags.push('code_fixed');
      if (nums.length) {
        const n = parseFloat(nums[nums.length - 1]);
        if (n > 0) row.qty = n;
      }
      rows.push(row);
    }
    return { kind: 'uds', rows: finalize('uds', rows, ctx), warnings: [] };
  }

  /* ---------- تحقق مشترك ---------- */
  /** يضيف علامات: كود غير معروف، كمية ناقصة، حجز غير موجود في الـ Checklist */
  function finalize(kind, rows, ctx = {}) {
    const known = ctx.reservations ? new Set(ctx.reservations) : null;
    return rows.map((r) => {
      const flags = new Set(r.flags || []);
      if (!r.code) flags.add('code_missing');
      else if (!C.get(r.code)) {
        flags.add('code_unknown');
        const near = C.nearest(r.code, 1);
        if (near.length === 1) r.suggest = near[0].code;
      }
      if (r.qty == null) flags.add('qty_missing');
      if (kind !== 'checklist' && known && r.reservation && !known.has(r.reservation)) {
        flags.add('res_unknown');
        const near = [...known].find((k) => U.lev(k, r.reservation, 1) <= 1);
        if (near) r.suggestRes = near;
      }
      r.flags = [...flags];
      return r;
    });
  }

  /* ---------- جداول Excel / CSV ---------- */
  const SYN = {
    code: ['sec #', 'sec#', 'sec', 'sec no', 'material #', 'material#', 'material', 'material no', 'material code', 'mat #', 'item code', 'code', 'رقم المادة', 'كود المادة', 'الكود', 'كود', 'رقم الصنف', 'رمز المادة', 'رقم sec'],
    desc: ['description', 'material description', 'material desc', 'material desc.', 'desc', 'الوصف', 'وصف المادة', 'البيان', 'وصف'],
    unit: ['unit', 'uom', 'الوحدة', 'وحدة'],
    qty: ['quantity', 'qty', 'الكمية', 'المطلوب', 'كمية', 'issued qty', 'المصروف', 'الكمية المطلوبة', 'الكمية المصروفة', 'الكمية المسجلة'],
    reservation: ['reservation', 'reservation no', 'reservation no.', 'رقم الحجز', 'الحجز'],
    item_no: ['item no', 'item no.', 'item', 'البند', 'رقم البند'],
    unloading: ['unloading point', 'unloading', 'نقطة التفريغ', 'work order', 'wo', 'رقم أمر العمل', 'أمر العمل', 'امر العمل'],
    reference: ['reference', 'ref', 'uds ref', 'uds', 'رقم المرجع', 'المرجع'],
    gp_no: ['gate pass', 'gate pass no', 'gatepass', 'رقم gate pass', 'رقم الجيت باس'],
    date: ['date', 'التاريخ'],
  };

  function guessMapping(headerRow) {
    const map = {};
    headerRow.forEach((h, idx) => {
      const k = String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, ' ');
      if (!k) return;
      for (const [field, list] of Object.entries(SYN)) {
        if (map[field] == null && list.includes(k)) map[field] = idx;
      }
    });
    return map;
  }

  /** يبحث عن صف العناوين ضمن أول 25 صفًا ويعيد {headerIndex, mapping} */
  function detectTable(matrix) {
    let best = { headerIndex: -1, mapping: {}, score: 0 };
    for (let i = 0; i < Math.min(matrix.length, 25); i++) {
      const m = guessMapping(matrix[i] || []);
      const score = Object.keys(m).length + (m.code != null ? 3 : 0);
      if (score > best.score) best = { headerIndex: i, mapping: m, score };
    }
    return best;
  }

  function tableToRows(kind, matrix, headerIndex, mapping, ctx = {}) {
    const rows = [];
    const warnings = [];
    for (let i = headerIndex + 1; i < matrix.length; i++) {
      const r = matrix[i] || [];
      const get = (f) => (mapping[f] == null ? '' : r[mapping[f]]);
      const rawCode = U.digits(get('code')).replace(/\D/g, '');
      if (!rawCode && !String(get('desc') || '').trim()) continue;
      if (!rawCode) {
        warnings.push(`السطر ${i + 1}: لا يوجد رقم مادة`);
        continue;
      }
      const row = {
        code: rawCode,
        qty: U.num(get('qty')),
        doc_desc: String(get('desc') || '').trim(),
        reservation: U.digits(get('reservation')).replace(/\D/g, ''),
        flags: [],
      };
      if (/^\d{9}$/.test(rawCode) === false) {
        const near = C.nearest(rawCode, 1);
        if (near.length === 1) {
          row.code = near[0].code;
          row.flags.push('code_fixed');
        }
      }
      if (kind === 'checklist') {
        row.item_no = String(U.digits(get('item_no')) || '').replace(/\D/g, '').padStart(row.item_no ? 4 : 0, '0');
        const unl = String(get('unloading') || '');
        const u = unl.match(RE_UNLOAD) || unl.match(RE_UNLOAD_LOOSE);
        if (u) {
          const d = u[1];
          row.work_order = d.length >= 12 ? d.slice(0, 9) : d;
          row.wo_type = d.length >= 12 ? d.slice(9, 12) : '';
          row.item_no = u[2].padStart(4, '0');
          row.unloading_point = 'W' + d + '/' + row.item_no;
        } else {
          const wo = U.digits(unl).replace(/\D/g, '');
          row.work_order = wo.length >= 9 ? wo.slice(0, 9) : wo;
          row.wo_type = wo.length >= 12 ? wo.slice(9, 12) : '';
          row.unloading_point = '';
        }
      }
      if (kind !== 'uds') row.uom = String(get('unit') || '').trim().toUpperCase();
      if (kind === 'uds') row.reference = String(get('reference') || '').trim();
      if (kind === 'gatepass') {
        row.line_no = String(get('item_no') || '').trim();
        row.gp_no = String(get('gp_no') || '').trim();
        row.date = U.parseDate(get('date'));
      }
      rows.push(row);
    }
    return { kind, rows: finalize(kind, rows, ctx), warnings };
  }

  /* ---------- نتيجة الذكاء الاصطناعي ---------- */
  /** يحوّل JSON القادم من نموذج الرؤية إلى نفس شكل مخرجات المحللات */
  function fromAI(kind, json, ctx = {}) {
    const rows = [];
    const list = (json && (json.rows || json.items)) || [];
    for (const x of list) {
      const code = U.digits(x.material || x.code || '').replace(/\D/g, '');
      const row = {
        code: code,
        qty: U.num(x.quantity != null ? x.quantity : x.qty),
        reservation: U.digits(x.reservation || '').replace(/\D/g, ''),
        doc_desc: String(x.description || '').trim(),
        uom: String(x.uom || '').trim(),
        flags: ['ai'],
      };
      const rc = code && !C.get(code) ? resolveCode(code) : null;
      if (rc) {
        row.code = rc.code;
        row.flags.push('code_fixed');
      }
      if (kind === 'checklist') {
        const unl = String(x.unloading_point || '');
        const u = unl.match(RE_UNLOAD) || unl.match(RE_UNLOAD_LOOSE);
        if (u) {
          const d = u[1];
          row.work_order = d.length >= 12 ? d.slice(0, 9) : d;
          row.wo_type = d.length >= 12 ? d.slice(9, 12) : '';
          row.item_no = u[2].padStart(4, '0');
          row.unloading_point = 'W' + d + '/' + row.item_no;
        } else {
          row.item_no = String(x.item_no || '').replace(/\D/g, '').padStart(4, '0');
          row.work_order = '';
          row.wo_type = '';
          row.unloading_point = unl;
        }
      }
      if (kind === 'gatepass') row.line_no = String(x.item_no || x.line_no || '').replace(/\D/g, '');
      if (kind === 'uds') row.reference = String(x.reference || '').trim();
      rows.push(row);
    }
    // التحقق من المجاميع المطبوعة في المستند
    const printed = (json && (json.subtotals || json.totals)) || [];
    if (printed.length) {
      const sums = new Map();
      rows.forEach((r) => sums.set(r.code, (sums.get(r.code) || 0) + (r.qty || 0)));
      printed.forEach((t) => {
        const rc = resolveCode(String(t.material || '').replace(/\D/g, ''));
        const code = rc ? rc.code : String(t.material || '').replace(/\D/g, '');
        const total = U.num(t.subtotal != null ? t.subtotal : t.total);
        if (code && total != null && sums.has(code) && sums.get(code) !== total) rows.filter((r) => r.code === code).forEach((r) => r.flags.push('sub_mismatch'));
      });
    }
    const out = { kind, rows: finalize(kind, rows, ctx), warnings: [] };
    if (kind === 'gatepass') {
      const h = (json && json.header) || {};
      out.header = {
        no: String(h.gate_pass_no || h.no || '').replace(/\D/g, ''),
        date: U.parseDate(h.date),
        erp_delivery: String(h.erp_delivery || '').replace(/\D/g, ''),
        material_doc: String(h.material_doc || '').replace(/\D/g, ''),
        plant: String(h.plant || ''),
        storage: String(h.storage_location || h.storage || ''),
        contractor: String(h.contractor || ''),
      };
    }
    if (json && Array.isArray(json.subtotals)) out.subtotals = json.subtotals;
    return out;
  }

  /** نص عربي يشرح كل علامة مراجعة */
  const FLAG_TEXT = {
    code_fixed: 'صُحّح رقم المادة تلقائيًا إلى أقرب كود في الكتالوج',
    code_inferred: 'استُنتج رقم المادة من الوصف وترتيب القائمة',
    code_missing: 'رقم المادة غير مقروء',
    code_unknown: 'رقم المادة غير موجود في الكتالوج',
    qty_missing: 'الكمية غير مقروءة',
    qty_unclear: 'الخط غير واضح: اكتب الكمية يدويًا',
    qty_inferred: 'الكمية محسوبة من المجموع الفرعي',
    sub_mismatch: 'مجموع المجموعة لا يطابق المجموع الفرعي المطبوع',
    row_missing: 'صف لم يُقرأ: المجموع الفرعي المطبوع أكبر من المقروء. أكمل الحجز والبند أو احذف الصف',
    qty_conflict: 'قراءتان مختلفتان للكمية: تحقق من الصورة',
    res_missing: 'رقم الحجز غير مقروء',
    res_inferred: 'رقم الحجز مستنتج من نفس أمر العمل',
    res_unknown: 'رقم الحجز غير موجود في الـ Checklist',
    wo_fixed: 'صُحّح أمر العمل ليطابق بقية بنود نفس الحجز',
    ai: 'قراءة بالذكاء الاصطناعي',
  };
  const BAD = new Set(['code_missing', 'code_unknown', 'qty_missing', 'qty_unclear', 'sub_mismatch', 'row_missing', 'qty_conflict']);
  const WARN = new Set(['code_fixed', 'code_inferred', 'qty_inferred', 'res_missing', 'res_inferred', 'res_unknown', 'wo_fixed']);
  const flagLevel = (flags) => ((flags || []).some((f) => BAD.has(f)) ? 'bad' : (flags || []).some((f) => WARN.has(f)) ? 'warn' : 'ok');

  MT.Parsers = {
    normLines,
    resolveCode,
    parseChecklist,
    parseGatePass,
    mergeGatePass,
    parseUds,
    finalize,
    guessMapping,
    detectTable,
    tableToRows,
    fromAI,
    FLAG_TEXT,
    flagLevel,
    SYN,
    RE_UNLOAD,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.Parsers;
})(typeof window !== 'undefined' ? window : globalThis);
