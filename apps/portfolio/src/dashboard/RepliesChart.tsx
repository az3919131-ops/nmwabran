import { useEffect, useRef, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { useLang } from "../i18n/lang";
import { formatDay, niceMax, shortDay } from "../lib/format";
import type { DayCount } from "../lib/stats";
import { D } from "./strings";

// عمود لكل يوم: رسم من فئة واحدة فلا حاجة لمفتاح ألوان. اليوم الحالي بلون ممتلئ والباقي أخفت.
const H = 220;
const PAD = { l: 28, r: 8, t: 22, b: 28 };
const MAX_BAR = 22; // سماكة العمود لا تتجاوز 24px

export function RepliesChart({ series }: { series: DayCount[] }) {
  const { t, lang } = useLang();
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  // الرسم يأخذ عرض حاويته الفعلي فتبقى الخطوط بحجمها الحقيقي على الجوال
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(280, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const peak = Math.max(0, ...series.map((d) => d.count));
  const top = niceMax(peak);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const slot = innerW / series.length;
  const barW = Math.min(MAX_BAR, slot * 0.6);
  const y = (v: number) => PAD.t + innerH - (v / top) * innerH;
  const ticks = [0, top / 2, top];
  const peakIdx = peak > 0 ? series.findIndex((d) => d.count === peak) : -1;
  const lastIdx = series.length - 1;
  const hv = hover !== null ? series[hover] : null;

  return (
    <div ref={wrap}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-white">{t(D.chart.title)}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {table ? <BarChart3 className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
          {table ? t(D.chart.asChart) : t(D.chart.asTable)}
        </button>
      </div>

      {peak === 0 && !table ? (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">{t(D.chart.empty)}</p>
      ) : table ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-navy-800 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">{t(D.chart.date)}</th>
                <th className="px-3 py-2 text-end font-semibold">{t(D.chart.count)}</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((d) => (
                <tr key={d.date} className="border-t border-white/5">
                  <td className="px-3 py-1.5 text-slate-300">{formatDay(d.date, lang, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="tabular px-3 py-1.5 text-end font-semibold text-white">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // الرسم يُقرأ دائمًا من اليسار (الأقدم) إلى اليمين (الأحدث) في اللغتين
        <div className="relative" dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full" role="group" aria-label={t(D.chart.title)}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.08)" strokeWidth="1" />
                <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8" className="tabular">
                  {Number.isInteger(v) ? v : v.toFixed(1)}
                </text>
              </g>
            ))}
            {series.map((d, i) => {
              const cx = PAD.l + slot * i + slot / 2;
              const h = Math.max(d.count > 0 ? 3 : 0, innerH - (y(d.count) - PAD.t));
              const x = cx - barW / 2;
              const yy = PAD.t + innerH - h;
              const r = Math.min(4, h, barW / 2);
              const current = i === lastIdx;
              const showLabel = d.count > 0 && (i === peakIdx || current);
              return (
                <g key={d.date}>
                  {d.count > 0 && (
                    // أعلى العمود مستدير 4px والقاعدة قائمة
                    <path
                      d={`M${x} ${yy + h}V${yy + r}Q${x} ${yy} ${x + r} ${yy}H${x + barW - r}Q${x + barW} ${yy} ${x + barW} ${yy + r}V${yy + h}Z`}
                      fill={current ? "#34d399" : "rgb(16 185 129 / 0.55)"}
                      opacity={hover === null || hover === i ? 1 : 0.6}
                    />
                  )}
                  {showLabel && (
                    <text x={cx} y={yy - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e2e8f0" className="tabular">
                      {d.count}
                    </text>
                  )}
                  {(i % 2 === lastIdx % 2 || slot > 56) && (
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
                      {shortDay(d.date)}
                    </text>
                  )}
                  {/* منطقة تفاعل أعرض من العمود تغطي ارتفاع الرسم كله */}
                  <rect
                    x={cx - slot / 2}
                    y={PAD.t}
                    width={slot}
                    height={innerH + 4}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${formatDay(d.date, lang, { weekday: "long", day: "numeric", month: "long" })}: ${d.count}`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>
          {hv && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-white/15 bg-navy-950 px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${((PAD.l + slot * hover + slot / 2) / W) * 100}%` }}
              role="status"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <p className="text-slate-400">{formatDay(hv.date, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
              <p className="font-bold text-white">
                {t(D.chart.series)}: <span className="tabular">{hv.count}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
