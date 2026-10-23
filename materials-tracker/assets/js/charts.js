/* رسوم SVG بسيطة بدون مكتبات: دائري واتجاه زمني. ألوان الحالات ثابتة في كل الشاشات. */
(function (g) {
  'use strict';
  const MT = (g.MT = g.MT || {});
  const U = MT.Util;
  const esc = U.esc;

  const COLORS = { ok: '#37E0C2', short: '#FFB627', excess: '#4B57E8', none: '#FF6B5E' };
  const INK = '#151845';
  const MUTED = '#4F5380';

  function polar(cx, cy, r, a) {
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  /** رسم دائري. slices: [{key,label,value,href}] */
  function donut(el, slices, { total, centerLabel = 'صنف' } = {}) {
    const sum = slices.reduce((s, x) => s + x.value, 0);
    const size = 240;
    const c = size / 2;
    const R = 108;
    const r = 66;
    const live = slices.filter((s) => s.value > 0);
    let paths = '';
    if (!sum) {
      paths = `<circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${INK}" stroke-width="${R - r}" stroke-dasharray="4 10" stroke-linecap="round" opacity=".16"/>`;
    } else if (live.length === 1) {
      const s = live[0];
      paths = `<a href="${s.href || '#'}" aria-label="${esc(s.label)}: ${s.value}"><circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${COLORS[s.key]}" stroke-width="${R - r}"/></a>`;
    } else {
      let a0 = -Math.PI / 2;
      for (const s of live) {
        const a1 = a0 + (s.value / sum) * Math.PI * 2;
        const [x0, y0] = polar(c, c, R, a0);
        const [x1, y1] = polar(c, c, R, a1);
        const [x2, y2] = polar(c, c, r, a1);
        const [x3, y3] = polar(c, c, r, a0);
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const pct = Math.round((s.value / sum) * 100);
        paths += `<a href="${s.href || '#'}" class="slice" aria-label="${esc(s.label)}: ${s.value} (${pct}%)"><path d="M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z" fill="${COLORS[s.key]}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><title>${esc(s.label)}: ${s.value} (${pct}%)</title></a>`;
        a0 = a1;
      }
    }
    const t = total != null ? total : sum;
    el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" class="chart chart-donut" role="group" aria-label="توزيع حالات الأصناف: ${slices.map((s) => `${s.label} ${s.value}`).join('، ')}">${paths}<text x="${c}" y="${c + 8}" text-anchor="middle" class="donut-n">${U.fmt(t, 0)}</text><text x="${c}" y="${c + 32}" text-anchor="middle" class="donut-l">${esc(centerLabel)}</text></svg>
      <ul class="legend">${slices.map((s) => `<li><a href="${s.href || '#'}" class="legend-item"><span class="swatch" style="background:${COLORS[s.key]}"></span><span class="legend-name">${esc(s.label)}</span><span class="legend-n figure">${U.fmt(s.value, 0)}</span><span class="legend-pct">${sum ? Math.round((s.value / sum) * 100) : 0}%</span></a></li>`).join('')}</ul>`;
  }

  /** منحنى ناعم يمر بالنقاط (Catmull-Rom إلى Bezier) */
  function smooth(pts) {
    if (pts.length < 3) return 'M' + pts.map((p) => p.join(' ')).join(' L');
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }

  /** اتجاه الصرف: أعمدة يومية + منحنى تراكمي + خط المطلوب */
  function trend(el, { days, required }) {
    const w = Math.max(280, el.clientWidth || 600);
    const h = w < 480 ? 240 : 300;
    const m = { t: 20, r: 16, b: 44, l: 46 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const first = days[0].date;
    const last = days[days.length - 1].date;
    let start = first;
    const span = U.daysBetween(first, last) + 1;
    if (span < 7) start = U.addDays(last, -6);
    const n = U.daysBetween(start, last) + 1;
    const byDate = new Map(days.map((d) => [d.date, d]));
    const maxV = Math.max(required || 0, days[days.length - 1].cum, 1);
    const top = niceMax(maxV);
    const x = (i) => m.l + (iw / n) * (i + 0.5);
    const y = (v) => m.t + ih - (v / top) * ih;
    const bw = Math.max(10, Math.min(44, (iw / n) * 0.6));

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i;
      grid += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${INK}" stroke-opacity="${i ? 0.08 : 0.25}" stroke-width="${i ? 1.5 : 2}" stroke-linecap="round"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${U.fmt(v, 0)}</text>`;
    }
    let bars = '';
    let cum = 0;
    const pts = [];
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
    for (let i = 0; i < n; i++) {
      const date = U.addDays(start, i);
      const d = byDate.get(date);
      if (d) {
        cum = d.cum;
        const bh = Math.max((d.qty / top) * ih, 4);
        bars += `<rect x="${x(i) - bw / 2}" y="${m.t + ih - bh}" width="${bw}" height="${bh}" rx="${Math.min(10, bw / 2)}" fill="url(#bar-g)"><title>${U.fmtDate(date)}: ${U.fmt(d.qty)} قطعة في ${d.passes} Gate Pass</title></rect>`;
        pts.push([x(i), y(cum)]);
      } else if (pts.length) {
        pts.push([x(i), y(cum)]);
      }
      if (i % step === 0 || i === n - 1) {
        const [, mo, da] = date.split('-');
        grid += `<text x="${x(i)}" y="${h - 16}" text-anchor="middle" class="ax">${da}/${mo}</text>`;
      }
    }
    const line = pts.length
      ? `<path d="${smooth(pts)}" fill="none" stroke="#18bfa3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#37E0C2" stroke="#fff" stroke-width="3"/>`).join('')}`
      : '';
    const req = required
      ? `<line x1="${m.l}" x2="${w - m.r}" y1="${y(required)}" y2="${y(required)}" stroke="${COLORS.none}" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/><text x="${w - m.r - 4}" y="${y(required) - 9}" text-anchor="end" class="ax ax-req">المطلوب ${U.fmt(required)}</text>`
      : '';
    const summary = days.map((d) => `${U.fmtDate(d.date)}: ${U.fmt(d.qty)}`).join('، ');
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="chart chart-trend" role="img" aria-label="اتجاه الصرف اليومي والتراكمي مقابل المطلوب. ${esc(summary)}"><defs><linearGradient id="bar-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a85ff"/><stop offset="1" stop-color="#4B57E8"/></linearGradient></defs>${grid}${req}${bars}${line}</svg>
      <ul class="legend legend-inline"><li><span class="swatch" style="background:#4B57E8"></span>المصروف اليومي</li><li><span class="swatch" style="background:#37E0C2"></span>التراكمي</li>${required ? `<li><span class="swatch" style="background:${COLORS.none}"></span>إجمالي المطلوب</li>` : ''}</ul>`;
  }

  function niceMax(v) {
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  /** شريط نسب مقسّم بالألوان: parts [{key,value}] */
  function stack(parts) {
    const sum = parts.reduce((s, p) => s + p.value, 0);
    if (!sum) return '<div class="stack stack-empty" aria-hidden="true"></div>';
    return `<div class="stack" role="img" aria-label="${parts.map((p) => `${p.label || p.key}: ${p.value}`).join('، ')}">${parts.filter((p) => p.value).map((p) => `<span style="flex:${p.value};background:${COLORS[p.key]}"></span>`).join('')}</div>`;
  }

  MT.Charts = { donut, trend, stack, COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT.Charts;
})(typeof window !== 'undefined' ? window : globalThis);
