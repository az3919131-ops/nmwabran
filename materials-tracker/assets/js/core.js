/* النواة: أدوات عامة + كتالوج المواد. تعمل في المتصفح وفي Node للاختبار. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});

  /* ---------- أدوات ---------- */
  const U = (MT.Util = {});

  U.PM_LINE = 'Project Manager | Eng. Ahmed Zahran';

  /** يحوّل الأرقام العربية والفارسية إلى لاتينية */
  U.digits = (s) =>
    String(s == null ? '' : s)
      .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660)
      .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0);

  U.uid = () => {
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.num = (v) => {
    if (v == null || v === '') return null;
    const n = parseFloat(U.digits(v).replace(/,/g, '').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  U.fmt = (n, max = 3) =>
    typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: max }) : '—';

  U.signed = (n) => (n > 0 ? '+' + U.fmt(n) : n < 0 ? '−' + U.fmt(Math.abs(n)) : '0');

  const pad = (n) => String(n).padStart(2, '0');
  U.isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.today = () => U.isoDate(new Date());
  U.addDays = (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return U.isoDate(dt);
  };
  U.daysBetween = (a, b) => {
    const pa = a.split('-').map(Number);
    const pb = b.split('-').map(Number);
    return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5);
  };

  /** يقرأ تاريخًا بصيغ شائعة ويعيد YYYY-MM-DD أو null */
  U.parseDate = (v) => {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return U.isoDate(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 864e5));
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    const s = U.digits(v);
    let m = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) return valid(+m[3], +m[2], +m[1]);
    return null;
  };
  function valid(y, mo, d) {
    if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }

  U.fmtDate = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  U.fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  U.debounce = (fn, ms = 200) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  /** مسافة ليفنشتاين مع خروج مبكر عند تجاوز الحد */
  U.lev = (a, b, max = 9) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let min = i;
      for (let j = 1; j <= b.length; j++) {
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur[j] = v;
        if (v < min) min = v;
      }
      if (min > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  };

  U.tokens = (s) =>
    String(s || '')
      .toUpperCase()
      .replace(/\bKIT(?=[A-Z]{3})/g, 'KIT ')
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter((t) => t && t.length > 1);

  const tokEq = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

  /** عدد الرموز المتطابقة بين وصفين (يتسامح مع الاختصارات مثل TERM و TERMINATION) */
  U.overlap = (a, b) => {
    const A = typeof a === 'string' ? U.tokens(a) : a;
    const B = typeof b === 'string' ? U.tokens(b) : b;
    const used = new Set();
    let m = 0;
    for (const t of A) {
      const j = B.findIndex((u, i) => !used.has(i) && tokEq(t, u));
      if (j >= 0) {
        used.add(j);
        m++;
      }
    }
    return { m, na: A.length, nb: B.length };
  };

  /** تشابه وصفين (0 إلى 1) */
  U.sim = (a, b) => {
    const { m, na, nb } = U.overlap(a, b);
    return na && nb ? (2 * m) / (na + nb) : 0;
  };

  U.groupBy = (arr, fn) => {
    const m = new Map();
    for (const x of arr) {
      const k = fn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  U.sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) : x) || 0, 0);

  /* ---------- الكتالوج ---------- */
  const C = (MT.Catalog = { byCode: new Map(), list: [], cats: [], source: '' });
  const CODE_RE = /^\d{9}$/;
  C.isCode = (c) => CODE_RE.test(String(c || ''));

  C.init = (raw) => {
    C.byCode = new Map();
    C.list = [];
    C.cats = (raw && raw.cats) || [];
    C.source = (raw && raw.source) || '';
    ((raw && raw.items) || []).forEach(([code, desc, unit, cat]) => {
      const it = {
        code,
        desc,
        unit,
        cat,
        category: cat >= 0 && C.cats[cat] ? C.cats[cat][0] : '',
        categoryAr: cat >= 0 && C.cats[cat] ? C.cats[cat][1] : '',
        source: 'catalog',
      };
      C.byCode.set(code, it);
      C.list.push(it);
    });
  };

  C.get = (code) => C.byCode.get(String(code || ''));

  /** يدمج أصنافًا مستوردة أو محفوظة: [كود، وصف، وحدة، فهرس القسم، اسم القسم] */
  C.merge = (items) => {
    items.forEach(([code, desc, unit, , categoryName]) => {
      if (!code) return;
      const ex = C.byCode.get(code);
      if (ex) {
        if (desc) ex.desc = desc;
        if (unit) ex.unit = unit;
        if (categoryName && ex.source !== 'catalog') ex.categoryAr = categoryName;
        ex.source = 'catalog';
      } else {
        const it = { code, desc: desc || '', unit: unit || 'EA', cat: -1, category: categoryName || '', categoryAr: categoryName || 'مضاف', source: 'catalog' };
        C.byCode.set(code, it);
        C.list.push(it);
      }
    });
  };

  /** يضيف مادة غير موجودة في الكتالوج (ظهرت في مستند) */
  C.addExtra = (code, desc, unit) => {
    if (!code || C.byCode.has(code)) return C.byCode.get(code);
    const it = { code, desc: desc || '', unit: unit || 'EA', cat: -1, category: '', categoryAr: 'خارج الكتالوج', source: 'document' };
    C.byCode.set(code, it);
    C.list.push(it);
    return it;
  };

  C.describe = (code) => {
    const it = C.get(code);
    return it ? it.desc : '';
  };

  /** أقرب أكواد في الكتالوج على مسافة تصل إلى max خانة */
  C.nearest = (code, max = 1) => {
    const out = [];
    const c = String(code || '');
    if (!c) return out;
    for (const it of C.list) {
      if (it.source !== 'catalog') continue;
      const d = U.lev(c, it.code, max);
      if (d <= max) out.push({ code: it.code, dist: d });
    }
    return out.sort((a, b) => a.dist - b.dist);
  };

  C.search = (q, limit = 12) => {
    q = U.digits(q).trim().toUpperCase();
    if (!q) return [];
    const parts = q.split(/\s+/);
    const res = [];
    for (const it of C.list) {
      const hay = it.code + ' ' + it.desc.toUpperCase() + ' ' + (it.categoryAr || '');
      if (parts.every((p) => hay.includes(p))) {
        res.push(it);
        if (res.length >= limit) break;
      }
    }
    return res;
  };

  /** يرتّب أكواد الكتالوج حسب قربها من وصف المستند ضمن حدود اختيارية (القوائم مرتبة تصاعديًا).
      يعيد { best, candidates }: best لا يُعيَّن إلا إذا كان وحيدًا بوضوح، حتى لا يُخمَّن كود خاطئ من وصف مقتطع. */
  C.byDesc = (desc, lo, hi, minContain = 0.7) => {
    const A = U.tokens(desc).filter((t) => !/^\d{1,3}$/.test(t));
    if (A.length < 2) return { best: null, candidates: [] };
    const scored = [];
    for (const it of C.list) {
      if (it.source !== 'catalog') continue;
      if (lo && it.code <= lo) continue;
      if (hi && it.code >= hi) continue;
      const { m, nb } = U.overlap(A, U.tokens(it.desc));
      const contain = m / A.length;
      if (contain < 0.5) continue;
      scored.push({ code: it.code, contain, dice: (2 * m) / (A.length + nb) });
    }
    scored.sort((x, y) => y.contain - x.contain || y.dice - x.dice);
    const top = scored[0];
    const second = scored[1];
    const clear = top && top.contain >= minContain && (!second || second.contain < minContain || top.dice - second.dice >= 0.25);
    return { best: clear ? top : null, candidates: scored.slice(0, 3).map((x) => x.code) };
  };

  if (g.MT_CATALOG) C.init(g.MT_CATALOG);
  if (typeof module !== 'undefined' && module.exports) module.exports = MT;
})(typeof window !== 'undefined' ? window : globalThis);
