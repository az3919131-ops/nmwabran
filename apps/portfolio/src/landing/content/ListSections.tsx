import { ExternalLink, FileText, MessageCircle, PlayCircle } from "lucide-react";
import { LinkedInIcon } from "../../components/Brand";
import type { LinkedinPage, PageLink, Platform, Service, YouTubeChannel } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import { S } from "../../i18n/strings";
import { useLang, type Bi } from "../../i18n/lang";
import { hostOf, pick, youtubeId } from "../../lib/content";
import { waLink } from "../../lib/whatsapp";
import { HiddenBadge } from "./EditControls";
import { CHANNEL_FIELDS, LINKEDIN_FIELDS, PAGE_FIELDS, PLATFORM_FIELDS, SERVICE_FIELDS } from "./fields";
import { Icon } from "./icons";
import { ItemForm } from "./ItemForm";
import { PlatformCard } from "./PlatformCard";
import { SectionShell } from "./SectionShell";
import { useListEditor } from "./useListEditor";

const empty = (): Bi => ({ ar: "", en: "" });

// ───────────── الخدمات ─────────────
export function ServicesSection() {
  const { t, lang } = useLang();
  const ed = useListEditor("services", "svc", () => ({ icon: "briefcase", title: empty(), description: empty() }) as Omit<Service, "id">);
  const list = ed.shown as Service[];
  return (
    <SectionShell id="services" sectionKey="services" title={t(C.services.title)} lead={t(C.services.lead)} empty={list.length === 0} addLabel={t(C.services_add)} onAdd={ed.open}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <aside className="glass h-fit rounded-2xl border-gold-400/35 p-6 lg:sticky lg:top-24">
          <span className="grid size-12 place-items-center rounded-xl bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/30">
            <MessageCircle className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 text-xl font-bold text-white">{t(C.services.ctaTitle)}</h3>
          <p className="mt-2 text-sm text-slate-400">{t(C.services.ctaText)}</p>
          <a className="btn btn-primary mt-5 w-full" href={waLink(t(S.hero.greeting))} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-5" aria-hidden />
            {t(S.actions.whatsapp)}
          </a>
        </aside>
        <ul className="glass divide-y divide-white/10 overflow-hidden rounded-2xl">
          {list.map((s) => (
            <li key={s.id} className={`relative flex flex-wrap items-start gap-x-4 gap-y-3 p-5 sm:flex-nowrap sm:p-6 ${s.hidden ? "opacity-60" : ""}`}>
              {ed.controls(s)}
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint-500/12 text-mint-400 ring-1 ring-mint-500/25">
                <Icon name={s.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
                  {pick(s.title, lang)}
                  {s.hidden && <HiddenBadge />}
                </h3>
                {pick(s.description, lang) && <p className="mt-1.5 text-sm text-slate-400">{pick(s.description, lang)}</p>}
                {s.href && (
                  <a className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-mint-400 hover:text-mint-300" href={s.href} {...(s.href.startsWith("#") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                    {pick(s.hrefLabel, lang) || t(C.platforms.open)}
                  </a>
                )}
              </div>
              <a className="btn btn-ghost btn-sm max-sm:w-full" href={waLink(`${t(C.services.message)} ${pick(s.title, lang)}`)} target="_blank" rel="noopener noreferrer">
                {t(C.services.order)}
                <span className="sr-only"> — {pick(s.title, lang)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      {ed.isOpen && ed.initial && <ItemForm title={t(ed.editingId ? C.services_edit : C.services_add)} fields={SERVICE_FIELDS} initial={ed.initial} onSubmit={ed.submit} onClose={ed.close} />}
    </SectionShell>
  );
}

// ───────────── المنصات ومواقع التأمين (نفس الهيكل) ─────────────
function PlatformList({ listKey, id, title, lead, openLabel, addLabel, editLabel, prefix, icon }: { listKey: "platforms" | "security"; id: string; title: Bi; lead: Bi; openLabel: Bi; addLabel: Bi; editLabel: Bi; prefix: string; icon: Platform["icon"] }) {
  const { t } = useLang();
  const ed = useListEditor(listKey, prefix, () => ({ name: empty(), description: empty(), category: empty(), url: "", status: "working", icon }) as Omit<Platform, "id">);
  const list = ed.shown as Platform[];
  return (
    <SectionShell id={id} sectionKey={listKey} title={t(title)} lead={t(lead)} empty={list.length === 0} addLabel={t(addLabel)} onAdd={ed.open}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <PlatformCard key={p.id} item={p} openLabel={openLabel} controls={ed.controls(p)} />
        ))}
      </div>
      {ed.isOpen && ed.initial && <ItemForm title={t(ed.editingId ? editLabel : addLabel)} fields={PLATFORM_FIELDS} initial={ed.initial} onSubmit={ed.submit} onClose={ed.close} />}
    </SectionShell>
  );
}

export const PlatformsSection = () => (
  <PlatformList listKey="platforms" id="platforms" title={C.platforms.title} lead={C.platforms.lead} openLabel={C.platforms.open} addLabel={C.platforms.add} editLabel={C.platforms.edit} prefix="pl" icon="globe" />
);
export const SecuritySection = () => (
  <PlatformList listKey="security" id="security" title={C.security.title} lead={C.security.lead} openLabel={C.security.open} addLabel={C.security.add} editLabel={C.security.edit} prefix="sec" icon="shield" />
);

// ───────────── يوتيوب ─────────────
export function YouTubeSection() {
  const { t, lang } = useLang();
  const ed = useListEditor("youtube", "yt", () => ({ name: empty(), description: empty(), url: "", videos: [] }) as Omit<YouTubeChannel, "id">);
  const list = ed.shown as YouTubeChannel[];
  return (
    <SectionShell id="youtube" sectionKey="youtube" title={t(C.youtube.title)} lead={t(C.youtube.lead)} empty={list.length === 0} addLabel={t(C.youtube.add)} onAdd={ed.open}>
      <div className="space-y-6">
        {list.map((ch) => (
          <article key={ch.id} className={`glass relative rounded-2xl p-5 sm:p-6 ${ch.hidden ? "opacity-60" : ""}`}>
            {ed.controls(ch)}
            <div className="flex flex-wrap items-start gap-5">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-red-500/15 text-red-300 ring-1 ring-red-400/30">
                <PlayCircle className="size-9" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex flex-wrap items-center gap-2 text-xl font-bold text-white">
                  {pick(ch.name, lang)}
                  {ch.hidden && <HiddenBadge />}
                </h3>
                {ch.handle && (
                  <p className="text-sm text-slate-400" dir="ltr">
                    {ch.handle}
                  </p>
                )}
                {pick(ch.description, lang) && <p className="mt-2 text-sm text-slate-300">{pick(ch.description, lang)}</p>}
                {(ch.subscribers || ch.views) && (
                  <dl className="mt-3 flex flex-wrap gap-2">
                    {ch.subscribers && (
                      <div className="pill text-slate-200">
                        <dt>{t(C.youtube.subscribers)}:</dt>
                        <dd className="tabular">{ch.subscribers}</dd>
                      </div>
                    )}
                    {ch.views && (
                      <div className="pill text-slate-200">
                        <dt>{t(C.youtube.views)}:</dt>
                        <dd className="tabular">{ch.views}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <a className="btn btn-primary mt-4" href={ch.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  {t(C.youtube.visit)}
                  <span className="sr-only"> — {pick(ch.name, lang)}</span>
                </a>
              </div>
            </div>
            {ch.videos.length > 0 && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <h4 className="mb-3 text-sm font-semibold text-slate-300">{t(C.youtube.featured)}</h4>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ch.videos.map((v) => {
                    const vid = youtubeId(v.url);
                    return (
                      <li key={v.id}>
                        <a className="group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/25" href={v.url} target="_blank" rel="noopener noreferrer">
                          <span className="relative block aspect-video bg-navy-950">
                            {vid ? <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" /> : null}
                            <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/10">
                              <PlayCircle className="size-12 text-white drop-shadow" aria-hidden />
                            </span>
                          </span>
                          <span className="block p-3 text-sm font-semibold text-slate-100">
                            {v.title}
                            <span className="sr-only"> — {t(C.youtube.watch)}</span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
      {ed.isOpen && ed.initial && <ItemForm title={t(ed.editingId ? C.youtube.edit : C.youtube.add)} fields={CHANNEL_FIELDS} initial={ed.initial} onSubmit={ed.submit} onClose={ed.close} />}
    </SectionShell>
  );
}

// ───────────── لينكدإن ─────────────
const pathOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").slice(1);
  } catch {
    return "";
  }
};

export function LinkedInSection() {
  const { t, lang } = useLang();
  const ed = useListEditor("linkedin", "li", () => ({ name: empty(), kind: "personal", url: "", description: empty() }) as Omit<LinkedinPage, "id">);
  const list = ed.shown as LinkedinPage[];
  return (
    <SectionShell id="linkedin" sectionKey="linkedin" title={t(C.linkedin.title)} lead={t(C.linkedin.lead)} empty={list.length === 0} addLabel={t(C.linkedin.add)} onAdd={ed.open}>
      <div className="grid gap-5 md:grid-cols-2">
        {list.map((p) => (
          <article key={p.id} className={`glass relative flex flex-col rounded-2xl p-5 sm:p-6 ${p.hidden ? "opacity-60" : ""}`}>
            {ed.controls(p)}
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30">
                <LinkedInIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <span className="pill border-sky-400/35 text-sky-200">{t(C.linkedin.kinds[p.kind])}</span>
                {p.hidden && (
                  <span className="ms-2 inline-block align-middle">
                    <HiddenBadge />
                  </span>
                )}
                <h3 className="mt-2 text-lg font-bold text-white">{pick(p.name, lang)}</h3>
              </div>
            </div>
            {pick(p.description, lang) && <p className="mt-3 text-sm text-slate-400">{pick(p.description, lang)}</p>}
            <p className="mt-3 truncate text-sm text-slate-500" dir="ltr">
              {pathOf(p.url)}
            </p>
            <div className="mt-auto pt-4">
              <a className="btn btn-primary" href={p.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                {t(C.linkedin.open)}
                <span className="sr-only"> — {pick(p.name, lang)}</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      {ed.isOpen && ed.initial && <ItemForm title={t(ed.editingId ? C.linkedin.edit : C.linkedin.add)} fields={LINKEDIN_FIELDS} initial={ed.initial} onSubmit={ed.submit} onClose={ed.close} />}
    </SectionShell>
  );
}

// ───────────── صفحاتي الخاصة ─────────────
export function PagesSection() {
  const { t, lang } = useLang();
  const ed = useListEditor("pages", "pg", () => ({ title: empty(), description: empty(), url: "" }) as Omit<PageLink, "id">);
  const list = ed.shown as PageLink[];
  return (
    <SectionShell id="pages" sectionKey="pages" title={t(C.pages.title)} lead={t(C.pages.lead)} empty={list.length === 0} addLabel={t(C.pages.add)} onAdd={ed.open}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <article key={p.id} className={`glass relative flex flex-col rounded-2xl p-5 ${p.hidden ? "opacity-60" : ""}`}>
            {ed.controls(p)}
            <span className="grid size-11 place-items-center rounded-xl bg-white/6 text-gold-300 ring-1 ring-white/10">
              <FileText className="size-5" aria-hidden />
            </span>
            <h3 className="mt-3 flex flex-wrap items-center gap-2 font-bold text-white">
              {pick(p.title, lang)}
              {p.hidden && <HiddenBadge />}
            </h3>
            {pick(p.description, lang) && <p className="mt-1.5 text-sm text-slate-400">{pick(p.description, lang)}</p>}
            <p className="mt-2 truncate text-sm text-slate-500" dir="ltr">
              {hostOf(p.url)}
            </p>
            <div className="mt-auto pt-4">
              <a className="btn btn-ghost btn-sm" href={p.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                {t(C.pages.open)}
                <span className="sr-only"> — {pick(p.title, lang)}</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      {ed.isOpen && ed.initial && <ItemForm title={t(ed.editingId ? C.pages.edit : C.pages.add)} fields={PAGE_FIELDS} initial={ed.initial} onSubmit={ed.submit} onClose={ed.close} />}
    </SectionShell>
  );
}
