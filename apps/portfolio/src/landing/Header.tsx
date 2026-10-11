import { useEffect, useState } from "react";
import { Download, Menu, X } from "lucide-react";
import { LogoMark } from "../components/Brand";
import { LangToggle } from "../components/LangToggle";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { downloadVCard } from "../lib/vcard";
import { useScrollSpy } from "../lib/useScrollSpy";

export const NAV_IDS = ["about", "experience", "projects", "certifications", "contact"] as const;

export function Header() {
  const { t, lang } = useLang();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useScrollSpy([...NAV_IDS]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links: Array<[(typeof NAV_IDS)[number], string]> = [
    ["about", t(S.nav.about)],
    ["experience", t(S.nav.experience)],
    ["projects", t(S.nav.projects)],
    ["certifications", t(S.nav.certifications)],
    ["contact", t(S.nav.contact)],
  ];

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

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {links.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active === id ? "bg-white/10 text-gold-300" : "text-slate-300 hover:text-white"
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
            className="btn btn-ghost btn-sm lg:hidden"
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
        <nav id="mobile-menu" aria-label="Mobile" className="container-x flex flex-col gap-1 pb-4 lg:hidden">
          {links.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setOpen(false)}
              className={`rounded-xl px-4 py-3 font-semibold ${active === id ? "bg-white/10 text-gold-300" : "text-slate-200 hover:bg-white/5"}`}
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
