import { useMemo, useState } from "react";
import { Copy, MessageCircle, Search } from "lucide-react";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n/lang";
import type { ReplyRow } from "../lib/dashboardApi";
import { formatDateTime, formatDay } from "../lib/format";
import { newestFirst, perDay, riyadhDate } from "../lib/stats";
import { waChatLink } from "../lib/whatsapp";
import { D } from "./strings";

const PAGE = 25;
type Range = "all" | "7" | "today";

export function filterReplies(replies: ReplyRow[], q: string, range: Range, today: string = riyadhDate()): ReplyRow[] {
  const needle = q.trim().toLowerCase();
  const allowed = range === "all" ? null : new Set(perDay(replies, today, range === "today" ? 1 : 7).map((d) => d.date));
  return newestFirst(replies).filter((r) => {
    if (allowed && !allowed.has(r.replyDate)) return false;
    if (!needle) return true;
    return [r.name, r.phone, r.incomingText, r.replyText].some((v) => v.toLowerCase().includes(needle));
  });
}

export function ReplyLog({ replies }: { replies: ReplyRow[] }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => filterReplies(replies, q, range), [replies, q, range]);
  const shown = rows.slice(0, limit);

  const copy = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.show("success", t(D.log.copied));
    } catch {
      toast.show("error", phone);
    }
  };

  const seg = (id: Range, label: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={range === id}
      onClick={() => {
        setRange(id);
        setLimit(PAGE);
      }}
      className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${range === id ? "bg-white text-navy-900" : "text-slate-300 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="me-auto text-xl font-bold text-white">{t(D.log.title)}</h2>
        <div role="group" aria-label={t(D.log.range)} className="flex rounded-xl border border-white/15 bg-white/5 p-0.5">
          {seg("all", t(D.log.all))}
          {seg("7", t(D.log.r7))}
          {seg("today", t(D.log.today))}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          className="field ps-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          placeholder={t(D.log.search)}
          aria-label={t(D.log.search)}
        />
      </div>

      {replies.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">{t(D.log.empty)}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">{t(D.log.noResults)}</p>
      ) : (
        <>
          <div aria-hidden className="hidden grid-cols-[9rem_11rem_1fr_1fr_5.5rem] gap-4 border-b border-white/10 px-3 pb-2 text-xs font-semibold text-slate-500 md:grid">
            <span>{t(D.log.when)}</span>
            <span>{t(D.log.from)}</span>
            <span>{t(D.log.incoming)}</span>
            <span>{t(D.log.sent)}</span>
            <span />
          </div>
          <ul className="divide-y divide-white/8">
            {shown.map((r) => (
              <li key={r.id} className="grid gap-x-4 gap-y-1.5 px-3 py-3 text-sm md:grid-cols-[9rem_11rem_1fr_1fr_5.5rem]">
                <time className="text-xs text-slate-400 md:text-sm" dateTime={r.createdAt || r.replyDate}>
                  {r.createdAt ? formatDateTime(r.createdAt, lang) : formatDay(r.replyDate, lang)}
                </time>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{r.name || t(D.log.unknownName)}</p>
                  <p className="tabular text-xs text-slate-500" dir="ltr">
                    +{r.phone}
                  </p>
                </div>
                <p className="break-words text-slate-300">
                  <span className="text-xs text-slate-500 md:hidden">{t(D.log.incoming)}: </span>
                  {r.incomingText}
                </p>
                <p className="line-clamp-3 whitespace-pre-line break-words text-slate-400">
                  <span className="text-xs text-slate-500 md:hidden">{t(D.log.sent)}: </span>
                  {r.replyText}
                </p>
                <div className="flex items-start gap-1.5 md:justify-end">
                  <a
                    className="grid size-9 place-items-center rounded-lg border border-white/12 text-mint-400 hover:bg-white/10"
                    href={waChatLink(r.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t(D.log.openChat)}: ${r.name || r.phone}`}
                    title={t(D.log.openChat)}
                  >
                    <MessageCircle className="size-4" aria-hidden />
                  </a>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-lg border border-white/12 text-slate-300 hover:bg-white/10"
                    onClick={() => copy(r.phone)}
                    aria-label={`${t(D.log.copy)}: ${r.phone}`}
                    title={t(D.log.copy)}
                  >
                    <Copy className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span className="tabular">
              {t(D.log.showing)} {shown.length} {t(D.log.of)} {rows.length}
            </span>
            {shown.length < rows.length && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit((n) => n + PAGE)}>
                {t(D.log.more)}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
