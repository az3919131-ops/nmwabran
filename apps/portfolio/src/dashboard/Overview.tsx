import { CheckCircle2, PauseCircle, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "../i18n/lang";
import type { DailyMessage, ReplyRow } from "../lib/dashboardApi";
import { formatDateTime, formatDay } from "../lib/format";
import type { Stats } from "../lib/stats";
import { RepliesChart } from "./RepliesChart";
import { D } from "./strings";

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="nums mt-1.5 text-3xl font-bold text-white sm:text-4xl">{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export function LatestReplies({ replies, onSeeAll }: { replies: ReplyRow[]; onSeeAll: () => void }) {
  const { t, lang } = useLang();
  if (!replies.length) return null;
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-white">{t(D.latest.title)}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSeeAll}>
          {t(D.latest.seeAll)}
        </button>
      </div>
      <ul className="divide-y divide-white/8">
        {replies.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="font-semibold text-slate-100">{r.name || t(D.log.unknownName)}</span>
            <span className="min-w-0 flex-1 basis-48 truncate text-slate-400">{r.incomingText}</span>
            <time className="text-xs text-slate-500" dateTime={r.createdAt || r.replyDate}>
              {r.createdAt ? formatDateTime(r.createdAt, lang) : formatDay(r.replyDate, lang)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Overview({ stats, message, latest, onSeeAll }: { stats: Stats; message: DailyMessage | null; latest: ReplyRow[]; onSeeAll: () => void }) {
  const { t, lang } = useLang();
  const yesterday = stats.series[stats.series.length - 2]?.count ?? 0;

  // الحالة تُعرض بأيقونة ونص وليس باللون وحده
  const status = message ? (
    message.enabled ? (
      <span className="inline-flex items-center gap-2 text-mint-400">
        <CheckCircle2 className="size-7" aria-hidden />
        {t(D.kpi.on)}
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 text-gold-400">
        <PauseCircle className="size-7" aria-hidden />
        {t(D.kpi.off)}
      </span>
    )
  ) : (
    <span className="inline-flex items-center gap-2 text-slate-400">
      <HelpCircle className="size-7" aria-hidden />
      {t(D.kpi.unknown)}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Tile label={t(D.kpi.today)} value={stats.today} sub={`${t(D.kpi.yesterday)}: ${yesterday}`} />
        <Tile label={t(D.kpi.last7)} value={stats.last7} />
        <Tile label={t(D.kpi.total)} value={stats.total} />
        <Tile label={t(D.kpi.contacts)} value={stats.contacts} />
        <div className="col-span-2 lg:col-span-1">
          <Tile label={t(D.kpi.status)} value={<span className="text-2xl sm:text-3xl">{status}</span>} sub={message?.updatedOn ? `${t(D.kpi.updated)}: ${formatDay(message.updatedOn, lang, { day: "numeric", month: "short", year: "numeric" })}` : undefined} />
        </div>
      </div>
      <div className="glass rounded-2xl p-4 sm:p-5">
        <RepliesChart series={stats.series} />
      </div>
      <LatestReplies replies={latest} onSeeAll={onSeeAll} />
    </div>
  );
}
