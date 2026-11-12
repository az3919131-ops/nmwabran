import { useEffect, useMemo, useState } from "react";
import { Download, Menu, X } from "lucide-react";
import { LogoMark } from "../components/Brand";
import { LangToggle } from "../components/LangToggle";
import { useToast } from "../components/Toast";
import { C } from "../i18n/content-strings";
import { useContent } from "../lib/ContentContext";
import { navItems, renderedSections, type NavGroup } from "../lib/sections";
import type { Bi } from "../i18n/lang";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { downloadVCard } from "../lib/vcard";
import { useScrollSpy } from "../lib/useScrollSpy";

const LABELS: Record<NavGroup, Bi> = {
  about: S.nav.about,
  services: C.nav.services,
  experience: S.nav.experience,
  projects: S.nav.projects,
  platforms: C.nav.platforms,
  presence: C.nav.presence,
  certifications: S.nav.certifications,
  contact: S.nav.contact,
};

export function Header() {
  const { t, lang } = useLang();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { content, editing } = useContent();
  const plan = useMemo(() => renderedSections(content, editing), [content, editing]);
  const nav = useMemo(() => navItems(plan), [plan]);
  const activeId = useScrollSpy(plan.map((e) => e.id));
  const activeGroup = plan.find((e) => e.id === activeId)?.group;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = nav.map((e) => [e.group, e.id, t(LABELS[e.group])] as const);

  const save = () => {
    downloadVCard(lang);
    toast.show("success", t(S.actions.saved));
    setOpen(false);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open ? "border-b border-white/10 bg-navy-900/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:rounded-lg focus:bg-gold-400 focus:px-3 focus:py-2 focus:text-navy-900"
      >
        {t(S.nav.skip)}
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <a href="#top" className="flex items-center gap-2.5 rounded-lg" aria-label={t(S.brand)}>
          <LogoMark size={34} />
          <span className="font-display text-lg text-white max-sm:hidden">{t(S.brand)}</span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
          {links.map(([group, id, label]) => (
            <a
              key={group}
              href={`#${id}`}
              aria-current={activeGroup === group ? "true" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                activeGroup === group ? "bg-white/10 text-gold-300" : "text-slate-300 hover:text-white"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle />
          <button type="button" onClick={save} className="btn btn-gold btn-sm max-md:hidden">
            <Download className="size-4" aria-hidden />
            {t(S.actions.saveContact)}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t(S.nav.close) : t(S.nav.menu)}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="container-x flex flex-col gap-1 pb-4 xl:hidden">
          {links.map(([group, id, label]) => (
            <a
              key={group}
              href={`#${id}`}
              onClick={() => setOpen(false)}
              className={`rounded-xl px-4 py-3 font-semibold ${activeGroup === group ? "bg-white/10 text-gold-300" : "text-slate-200 hover:bg-white/5"}`}
            >
              {label}
            </a>
          ))}
          <button type="button" onClick={save} className="btn btn-gold mt-2 md:hidden">
            <Download className="size-4" aria-hidden />
            {t(S.actions.saveContact)}
          </button>
        </nav>
      )}
    </header>
  );
}
