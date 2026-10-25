/* محرك المقارنة بين المصادر الثلاثة: Checklist (المطلوب) و UDS (المسجل) و Gate Pass (المصروف فعليًا).
   دوال نقية بلا اعتماد على الواجهة. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const C = MT.Catalog;

  const r3 = (x) => Math.round((x || 0) * 1000) / 1000;

  const STATUS = {
    ok: { key: 'ok', label: 'مطابق', glyph: '●', hint: 'المصروف يساوي المطلوب' },
    short: { key: 'short', label: 'ناقص', glyph: '▼', hint: 'المصروف أقل من المطلوب' },
    excess: { key: 'excess', label: 'زائد', glyph: '▲', hint: 'المصروف أكثر من المطلوب أو غير مطلوب' },
    none: { key: 'none', label: 'لم يُصرف', glyph: '✕', hint: 'مطلوب ولم يُصرف شيء' },
    na: { key: 'na', label: '—', glyph: '', hint: '' },
  };

  /** يقارن مرجعًا بفعلي. expected = null تعني أن المادة غير موجودة في مصدر المرجع */
  function relate(expected, actual) {
    actual = r3(actual);
    if (expected == null) return actual > 0 ? 'excess' : 'na';
    expected = r3(expected);
    if (actual <= 0) return expected > 0 ? 'none' : 'ok';
    if (actual < expected) return 'short';
    if (actual > expected) return 'excess';
    return 'ok';
  }

  function inPeriod(date, opts) {
    if (!opts || (!opts.from && !opts.to)) return true;
    if (!date) return true;
    if (opts.from && date < opts.from) return false;
    if (opts.to && date > opts.to) return false;
    return true;
  }

  function matInfo(code, fallbackDesc) {
    const it = C.get(code);
    return {
      desc: (it && it.desc) || fallbackDesc || '',
      unit: (it && it.unit) || '',
      category: (it && it.categoryAr) || '',
      inCatalog: !!(it && it.source === 'catalog'),
    };
  }

  /** خريطة الحجز إلى أمر العمل كما تظهر في الـ Checklist */
  function reservationMap(checklist) {
    const votes = new Map();
    for (const l of checklist) {
      if (!l.reservation || !l.work_order) continue;
      const v = votes.get(l.reservation) || new Map();
      v.set(l.work_order, (v.get(l.work_order) || 0) + 1);
      votes.set(l.reservation, v);
    }
    const out = new Map();
    for (const [res, v] of votes) {
      const wo = [...v.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const line = checklist.find((l) => l.reservation === res && l.work_order === wo);
      out.set(res, { wo, type: (line && line.wo_type) || '' });
    }
    return out;
  }

  /* ---------- الوحدات: القطع تُجمع معًا، والأمتار والكيلومترات كل منها وحدها ---------- */
  const UNIT_LABEL = { PCS: 'قطعة', M: 'متر', KM: 'كم' };
  /** المجموعة من وحدة مكتوبة (من المستند أو الكتالوج): M وKM مستقلتان، وغيرهما قطع */
  const unitGroup = (u) => {
    const x = String(u || '').trim().toUpperCase();
    if (x === 'M' || x === 'MTR' || x === 'METER' || x === 'METRE') return 'M';
    if (x === 'KM') return 'KM';
    return 'PCS';
  };
  const firstUom = (...lists) => {
    for (const l of lists) {
      const hit = l.find((x) => x && x.uom && String(x.uom).trim());
      if (hit) return String(hit.uom).trim();
    }
    return '';
  };
  const emptyUnits = () => ({ PCS: { cl: 0, uds: 0, gp: 0 }, M: { cl: 0, uds: 0, gp: 0 }, KM: { cl: 0, uds: 0, gp: 0 } });
  const addUnits = (a, b) => {
    for (const k of Object.keys(a)) for (const f of ['cl', 'uds', 'gp']) a[k][f] = r3(a[k][f] + ((b[k] && b[k][f]) || 0));
    return a;
  };
  /** كميات حقل واحد (cl أو uds أو gp) مفصولة بالوحدة: القطع دائمًا، والأمتار والكيلومترات إن وُجدت */
  const unitSplit = (units, field) =>
    ['PCS', 'M', 'KM']
      .map((k) => ({ unit: k, label: UNIT_LABEL[k], value: r3((units[k] && units[k][field]) || 0) }))
      .filter((x, i) => i === 0 || x.value > 0);

  function build(data, opts = {}) {
    const checklist = data.checklist || [];
    const uds = data.uds || [];
    const gps = (data.gatePasses || []).filter((p) => inPeriod(p.date, opts));
    const resWo = reservationMap(checklist);

    const rows = new Map();
    const row = (code, doc) => {
      let r = rows.get(code);
      if (!r) {
        r = { code, docDesc: doc || '', cl: 0, uds: 0, gp: 0, hasCl: false, hasUds: false, clLines: [], udsLines: [], gpLines: [] };
        rows.set(code, r);
      }
      if (!r.docDesc && doc) r.docDesc = doc;
      return r;
    };

    for (const l of checklist) {
      const r = row(l.code, l.doc_desc);
      r.cl += l.qty || 0;
      r.hasCl = true;
      r.clLines.push(l);
    }
    for (const u of uds) {
      const r = row(u.code, u.doc_desc);
      r.uds += u.qty || 0;
      r.hasUds = true;
      r.udsLines.push(u);
    }
    for (const p of gps) {
      for (const it of p.items || []) {
        const r = row(it.code, it.doc_desc);
        r.gp += it.qty || 0;
        r.gpLines.push({ ...it, gpNo: p.no, date: p.date, gpId: p.id });
      }
    }

    const list = [];
    for (const r of rows.values()) {
      r.cl = r3(r.cl);
      r.uds = r3(r.uds);
      r.gp = r3(r.gp);
      Object.assign(r, matInfo(r.code, r.docDesc));
      const base = r.hasCl ? r.cl : r.hasUds ? r.uds : null;
      r.base = base;
      r.status = relate(base, r.gp);
      r.unrequested = !r.hasCl && !r.hasUds && r.gp > 0;
      r.clUds = r.hasUds || r.hasCl ? relate(r.hasCl ? r.cl : null, r.uds) : 'na';
      r.udsGp = relate(r.hasUds ? r.uds : null, r.gp);
      r.diffGpCl = r.hasCl ? r3(r.gp - r.cl) : null;
      r.diffUdsCl = r.hasCl && r.hasUds ? r3(r.uds - r.cl) : null;
      r.diffGpUds = r.hasUds ? r3(r.gp - r.uds) : null;
      r.shortVsCl = r.hasCl ? Math.max(0, r3(r.cl - r.gp)) : 0;
      r.shortVsUds = r.hasUds ? Math.max(0, r3(r.uds - r.gp)) : 0;
      r.udsDiff = r.hasUds && r3(r.uds - r.gp) !== 0;
      r.reservations = [...new Set([...r.clLines, ...r.gpLines].map((x) => x.reservation).filter(Boolean))];
      r.workOrders = [
        ...new Set(
          r.clLines
            .map((x) => x.work_order)
            .concat(r.gpLines.map((x) => x.reservation && resWo.has(x.reservation) && resWo.get(x.reservation).wo))
            .filter(Boolean)
        ),
      ];
      list.push(r);
    }
    list.sort((a, b) => a.code.localeCompare(b.code));

    const counts = { total: list.length, ok: 0, short: 0, excess: 0, none: 0, udsDiff: 0, unknown: 0 };
    for (const r of list) {
      if (counts[r.status] != null) counts[r.status]++;
      if (r.udsDiff) counts.udsDiff++;
      if (!r.inCatalog) counts.unknown++;
    }

    const unitTotals = emptyUnits();
    for (const r of list) {
      // الوحدة المكتوبة في المستند أولى من وحدة الكتالوج (الكابلات قد تُكتب بالمتر في المستند وبالكيلومتر في الكتالوج)
      r.unitGroup = unitGroup(firstUom(r.clLines, r.udsLines, r.gpLines) || r.unit);
      const t = unitTotals[r.unitGroup];
      t.cl = r3(t.cl + r.cl);
      t.uds = r3(t.uds + r.uds);
      t.gp = r3(t.gp + r.gp);
    }

    const wos = workOrders(checklist, gps, resWo);
    return {
      rows: list,
      counts,
      unitTotals,
      workOrders: wos,
      resWo,
      totals: {
        cl: r3(U.sum(list, (r) => r.cl)),
        uds: r3(U.sum(list, (r) => r.uds)),
        gp: r3(U.sum(list, (r) => r.gp)),
      },
      hasUds: uds.length > 0,
      hasCl: checklist.length > 0,
      gatePasses: gps,
    };
  }

  /** مقارنة على مستوى أمر العمل: تربط بنود الـ Gate Pass بالـ Checklist عبر (رقم الحجز + المادة) */
  function workOrders(checklist, gps, resWo) {
    const pool = new Map();
    const noRes = [];
    for (const p of gps) {
      for (const it of p.items || []) {
        if (!it.reservation) {
          noRes.push({ ...it, gpNo: p.no });
          continue;
        }
        const k = it.reservation + '|' + it.code;
        const e = pool.get(k) || { qty: 0, items: [] };
        e.qty += it.qty || 0;
        e.items.push({ ...it, gpNo: p.no });
        pool.set(k, e);
      }
    }

    const woKey = (l) => l.work_order || (l.reservation && resWo.has(l.reservation) && resWo.get(l.reservation).wo) || (l.reservation ? 'RES:' + l.reservation : 'NOWO');
    const groups = new Map();
    const getGroup = (key, l) => {
      let w = groups.get(key);
      if (!w) {
        const info = l.reservation && resWo.get(l.reservation);
        w = {
          key,
          wo: key.startsWith('RES:') || key === 'NOWO' ? '' : key,
          type: (l.wo_type || (info && info.type) || ''),
          reservations: new Set(),
          lines: [],
        };
        groups.set(key, w);
      }
      if (l.reservation) w.reservations.add(l.reservation);
      return w;
    };

    const byResCode = U.groupBy(checklist, (l) => (l.reservation || '') + '|' + l.code);
    for (const [k, lines] of byResCode) {
      lines.sort((a, b) => String(a.item_no || '').localeCompare(String(b.item_no || '')));
      const e = pool.get(k);
      let remaining = e ? e.qty : 0;
      const made = [];
      for (const l of lines) {
        const take = Math.min(l.qty || 0, remaining);
        remaining = r3(remaining - take);
        const w = getGroup(woKey(l), l);
        const out = {
          code: l.code,
          item_no: l.item_no,
          reservation: l.reservation,
          unloading: l.unloading_point,
          required: r3(l.qty || 0),
          issued: r3(take),
          extra: false,
        };
        w.lines.push(out);
        made.push(out);
      }
      if (remaining > 0 && made.length) made[made.length - 1].issued = r3(made[made.length - 1].issued + remaining);
      if (e) e.consumed = true;
    }

    for (const [k, e] of pool) {
      if (e.consumed) continue;
      const [res, code] = k.split('|');
      const info = resWo.get(res);
      const w = getGroup(info ? info.wo : 'RES:' + res, { reservation: res, wo_type: info && info.type });
      w.lines.push({ code, item_no: '', reservation: res, unloading: '', required: 0, issued: r3(e.qty), extra: true });
    }
    if (noRes.length) {
      const w = getGroup('NOWO', {});
      for (const it of noRes) w.lines.push({ code: it.code, item_no: '', reservation: '', unloading: '', required: 0, issued: r3(it.qty || 0), extra: true });
    }

    const out = [];
    for (const w of groups.values()) {
      for (const l of w.lines) {
        Object.assign(l, matInfo(l.code));
        l.status = l.extra ? 'excess' : relate(l.required, l.issued);
      }
      w.lines.sort((a, b) => a.code.localeCompare(b.code) || String(a.item_no).localeCompare(String(b.item_no)));
      w.reservations = [...w.reservations];
      w.required = r3(U.sum(w.lines, (l) => l.required));
      w.issued = r3(U.sum(w.lines, (l) => l.issued));
      const reqLines = w.lines.filter((l) => l.required > 0);
      const covered = U.sum(reqLines, (l) => Math.min(l.issued, l.required));
      w.pct = w.required > 0 ? Math.round((covered / w.required) * 100) : 0;
      if (!reqLines.length) w.status = 'excess';
      else if (reqLines.every((l) => l.issued <= 0)) w.status = 'none';
      else if (reqLines.some((l) => l.status === 'short' || l.status === 'none')) w.status = 'short';
      else if (w.lines.some((l) => l.status === 'excess')) w.status = 'excess';
      else w.status = 'ok';
      out.push(w);
    }
    const rank = { none: 0, short: 1, excess: 2, ok: 3 };
    return out.sort((a, b) => rank[a.status] - rank[b.status] || String(a.wo).localeCompare(String(b.wo)));
  }

  /** سلسلة زمنية للمصروف حسب تاريخ الـ Gate Pass */
  function trend(data, opts = {}) {
    const gps = (data.gatePasses || []).filter((p) => inPeriod(p.date, opts) && p.date);
    const byDay = new Map();
    for (const p of gps) {
      const e = byDay.get(p.date) || { date: p.date, qty: 0, passes: 0 };
      e.qty += U.sum(p.items || [], (i) => i.qty);
      e.passes += 1;
      byDay.set(p.date, e);
    }
    const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    for (const d of days) {
      d.qty = r3(d.qty);
      cum = r3(cum + d.qty);
      d.cum = cum;
    }
    const checklistTotal = r3(U.sum(data.checklist || [], (l) => l.qty));
    const udsTotal = r3(U.sum(data.uds || [], (l) => l.qty));
    return { days, required: checklistTotal || udsTotal };
  }

  /** مقارنة بين مصدرين محددين لكل مادة: pair = 'cl-uds' | 'cl-gp' | 'uds-gp' */
  function pairwise(result, pair) {
    const [a, b] = pair.split('-');
    const val = (r, k) => (k === 'cl' ? (r.hasCl ? r.cl : null) : k === 'uds' ? (r.hasUds ? r.uds : null) : r.gp);
    const rows = [];
    for (const r of result.rows) {
      const ref = val(r, a);
      const act = val(r, b) || 0;
      if (ref == null && act === 0) continue;
      rows.push({ ...r, ref, act, diff: r3(act - (ref || 0)), pairStatus: relate(ref, act) });
    }
    return rows;
  }

  /** الناقص: موجود في Checklist أو UDS ولم يُصرف كاملًا في Gate Pass */
  function shortage(result) {
    return result.rows
      .filter((r) => (r.hasCl || r.hasUds) && r.gp < Math.max(r.cl, r.uds))
      .map((r) => ({
        ...r,
        missingFrom: r.gp <= 0 ? 'غير موجود في Gate Pass' : 'مصروف جزئيًا',
        missingQty: r3(Math.max(r.cl, r.uds) - r.gp),
      }));
  }

  function alerts(result) {
    const out = [];
    const c = result.counts;
    if (c.none) out.push({ level: 'danger', text: `${c.none} صنف مطلوب ولم يُصرف`, filter: 'none' });
    if (c.short) out.push({ level: 'warn', text: `${c.short} صنف مصروف بكمية ناقصة`, filter: 'short' });
    const unreq = result.rows.filter((r) => r.unrequested).length;
    const exc = c.excess;
    if (exc) out.push({ level: 'info', text: `${exc} صنف مصروف أكثر من المطلوب${unreq ? ` (منها ${unreq} غير مطلوب أصلًا)` : ''}`, filter: 'excess' });
    if (result.hasUds && c.udsDiff) out.push({ level: 'warn', text: `${c.udsDiff} صنف يختلف فيه UDS عن الـ Gate Pass`, filter: 'uds' });
    if (c.unknown) out.push({ level: 'warn', text: `${c.unknown} كود غير موجود في الكتالوج`, filter: 'unknown' });
    return out;
  }

  /** نافذة الفترة السابقة لحساب التغيّر */
  function previousWindow(win, today) {
    today = today || U.today();
    if (!win || (!win.from && !win.to)) return { from: null, to: U.addDays(today, -7), label: 'عن قبل 7 أيام' };
    const to = win.to || today;
    const from = win.from || U.addDays(to, -29);
    const len = U.daysBetween(from, to) + 1;
    return { from: U.addDays(from, -len), to: U.addDays(from, -1), label: 'عن الفترة السابقة' };
  }

  MT.Compare = { STATUS, relate, build, UNIT_LABEL, unitGroup, emptyUnits, addUnits, unitSplit, workOrders, trend, pairwise, shortage, alerts, previousWindow, inPeriod, reservationMap, r3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.Compare;
})(typeof window !== 'undefined' ? window : globalThis);
