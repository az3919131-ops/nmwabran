import type { ReplyRow } from "./dashboardApi";

/** تاريخ اليوم بتوقيت الرياض بصيغة yyyy-MM-dd (نفس صيغة reply_date التي يكتبها workflow) */
export function riyadhDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type DayCount = { date: string; count: number };

/** يرجع آخر `days` يومًا (القديم أولًا) مع عدد الردود في كل يوم */
export function perDay(replies: ReplyRow[], today: string, days = 14): DayCount[] {
  const counts = new Map<string, number>();
  for (const r of replies) counts.set(r.replyDate, (counts.get(r.replyDate) ?? 0) + 1);
  const base = new Date(`${today}T00:00:00Z`);
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: d, count: counts.get(d) ?? 0 });
  }
  return out;
}

export type Stats = {
  today: number;
  total: number;
  contacts: number;
  last7: number;
  series: DayCount[];
  latest: ReplyRow | null;
};

export function computeStats(replies: ReplyRow[], today: string = riyadhDate()): Stats {
  const series = perDay(replies, today, 14);
  const sorted = [...replies].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  return {
    today: series[series.length - 1]?.count ?? 0,
    total: replies.length,
    contacts: new Set(replies.map((r) => r.phone).filter(Boolean)).size,
    last7: series.slice(-7).reduce((n, d) => n + d.count, 0),
    series,
    latest: sorted[0] ?? null,
  };
}

export const sortKey = (r: ReplyRow) => r.createdAt || r.replyDate;

/** أحدث أولًا */
export function newestFirst(replies: ReplyRow[]): ReplyRow[] {
  return [...replies].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}
