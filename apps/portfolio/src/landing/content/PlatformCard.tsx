import { CalendarDays, ExternalLink, Eye as EyeIcon, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Platform } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import { useLang, type Bi } from "../../i18n/lang";
import { hostOf, pick } from "../../lib/content";
import { formatLaunch } from "../../lib/format";
import { HiddenBadge } from "./EditControls";
import { Icon } from "./icons";
import { PreviewModal } from "./PreviewModal";
import { ScaledFrame } from "./ScaledFrame";
import { StatusPill } from "./StatusPill";

const TINTS = [
  "from-mint-500/35 via-mint-500/10 to-navy-800",
  "from-gold-400/30 via-gold-400/10 to-navy-800",
  "from-sky-400/30 via-sky-400/10 to-navy-800",
  "from-indigo-400/30 via-indigo-400/10 to-navy-800",
];
const tintOf = (id: string) => TINTS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TINTS.length]!;

/** بطاقة منصة أو موقع: الحالة والتصنيف والرابط وتاريخ الإطلاق؛ المنصة الرئيسية تُميَّز. */
export function PlatformCard({ item, openLabel, controls }: { item: Platform; openLabel: Bi; controls?: ReactNode }) {
  const { t, lang } = useLang();
  const [preview, setPreview] = useState(false);
  const name = pick(item.name, lang);
  const stopped = item.status === "stopped";
  const canEmbed = item.embed === true && !stopped;

  return (
    <article className={`glass group relative flex flex-col overflow-hidden rounded-2xl transition-colors hover:border-white/20 ${item.featured ? "border-gold-400/45 md:col-span-2 md:flex-row" : ""} ${item.hidden ? "opacity-60" : ""}`}>
      {controls}

      {/* الصورة أو المعاينة أو الأيقونة */}
      <div className={`relative aspect-[16/9] shrink-0 overflow-hidden bg-gradient-to-br ${tintOf(item.id)} ${item.featured ? "md:aspect-auto md:min-h-64 md:w-[46%]" : ""}`}>
        {canEmbed ? (
          <>
            <ScaledFrame url={item.url} title={name} />
            <button type="button" className="absolute inset-0 z-[1] cursor-zoom-in" onClick={() => setPreview(true)} aria-label={`${t(C.platforms.preview)}: ${name}`} />
          </>
        ) : item.imageUrl ? (
          <img src={item.imageUrl} alt={name} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center [background-image:radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.09)_1px,transparent_0)] [background-size:18px_18px]">
            <span className="grid size-16 place-items-center rounded-2xl bg-navy-900/70 text-gold-300 ring-1 ring-white/15 sm:size-20">
              <Icon name={item.icon} className="size-8 sm:size-10" />
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute start-3 top-3 z-[2] flex flex-wrap items-center gap-2">
          {item.featured && (
            <span className="pill border-gold-400/50 bg-navy-950/85 text-gold-300 backdrop-blur">
              <Star className="size-3.5 fill-current" aria-hidden />
              {t(C.platforms.main)}
            </span>
          )}
          {item.hidden && <HiddenBadge />}
        </div>
        <div className="pointer-events-none absolute bottom-3 start-3 z-[2]">
          <StatusPill status={item.status} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        {pick(item.category, lang) && <span className="pill w-fit border-white/15 text-slate-300">{pick(item.category, lang)}</span>}
        <h3 className={`mt-3 font-bold text-white ${item.featured ? "text-2xl" : "text-lg"}`}>{name}</h3>
        {pick(item.description, lang) && <p className="mt-2 text-sm text-slate-400">{pick(item.description, lang)}</p>}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-400">
          {item.launchedAt && (
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-mint-400" aria-hidden />
              {t(C.platforms.launched)} {formatLaunch(item.launchedAt, lang)}
            </p>
          )}
          <p dir="ltr" className="truncate">
            {hostOf(item.url)}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-5">
          {stopped ? (
            <span className="btn btn-ghost cursor-not-allowed opacity-60" aria-disabled="true">
              {t(C.platforms.stopped)}
            </span>
          ) : (
            <a className="btn btn-primary" href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              {t(openLabel)}
              <span className="sr-only"> — {name}</span>
            </a>
          )}
          {canEmbed && (
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(true)}>
              <EyeIcon className="size-4" aria-hidden />
              {t(C.platforms.preview)}
            </button>
          )}
        </div>
      </div>
      {preview && <PreviewModal url={item.url} name={name} onClose={() => setPreview(false)} />}
    </article>
  );
}
