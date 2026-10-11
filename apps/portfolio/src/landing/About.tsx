import { FileSignature, GanttChartSquare, GraduationCap, Network, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { capabilities, languages, tools, type Capability } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";

const ICONS: Record<Capability["icon"], LucideIcon> = {
  gantt: GanttChartSquare,
  contract: FileSignature,
  grid: Network,
  wallet: Wallet,
  shield: ShieldCheck,
  mentor: GraduationCap,
};

export function About() {
  const { t } = useLang();
  return (
    <section id="about" aria-labelledby="about-title" className="section-pad">
      <div className="container-x">
        <SectionHeading id="about-title" title={t(S.about.title)} lead={t(S.about.lead)} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <article key={c.title.en} className="glass rounded-2xl p-5 transition-colors hover:border-mint-500/40">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-mint-500/12 text-mint-400 ring-1 ring-mint-500/25">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-lg font-bold text-white">{t(c.title)}</h3>
                <p className="mt-2 text-sm text-slate-400">{t(c.text)}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">{t(S.about.tools)}</h3>
            <ul className="flex flex-wrap gap-2">
              {tools.map((x) => (
                <li key={x} className="pill text-slate-200" dir="ltr">
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">{t(S.about.languages)}</h3>
            <ul className="space-y-3">
              {languages.map((l) => (
                <li key={l.name.en}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-white">{t(l.name)}</span>
                    <span className="text-slate-400">{t(l.level)}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < l.score ? "bg-gold-400" : "bg-white/10"}`} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
