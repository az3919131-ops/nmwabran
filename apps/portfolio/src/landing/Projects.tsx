import { SectionHeading } from "../components/SectionHeading";
import { projects } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";

export function Projects() {
  const { t } = useLang();
  return (
    <section id="projects" aria-labelledby="proj-title" className="section-pad">
      <div className="container-x">
        <SectionHeading id="proj-title" title={t(S.projects.title)} lead={t(S.projects.lead)} />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <article
              key={p.id}
              className={`glass flex flex-col rounded-2xl p-5 transition-colors hover:border-gold-400/40 sm:p-6 ${i === 0 ? "md:col-span-2" : ""}`}
            >
              <span className="pill w-fit border-gold-400/30 bg-gold-400/10 text-gold-300">{t(p.tag)}</span>
              <h3 className="mt-4 text-xl font-bold text-white">{t(p.title)}</h3>
              <p className="mt-2 text-sm text-slate-400">{t(p.scope)}</p>
              {p.places && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {t(p.places).map((x) => (
                    <li key={x} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-200">
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
