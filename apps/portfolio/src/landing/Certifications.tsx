import { Award, BadgeCheck, GraduationCap, Hourglass, Presentation, ScrollText, type LucideIcon } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { credentials, trainingCourses, type Credential } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";

const KIND_ICON: Record<Credential["kind"], LucideIcon> = {
  education: GraduationCap,
  certificate: Award,
  course: ScrollText,
  experience: Presentation,
};

export function Certifications() {
  const { t } = useLang();
  return (
    <section id="certifications" aria-labelledby="cert-title" className="section-pad bg-navy-950/60">
      <div className="container-x">
        <SectionHeading id="cert-title" title={t(S.certs.title)} lead={t(S.certs.lead)} />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {credentials.map((c) => {
            const Icon = KIND_ICON[c.kind];
            const pending = c.status === "in-progress";
            return (
              <article key={c.id} className={`glass flex flex-col rounded-2xl p-5 ${pending ? "border-gold-400/35" : ""}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/6 text-gold-300 ring-1 ring-white/10">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span
                    className={`pill ${pending ? "border-gold-400/40 bg-gold-400/10 text-gold-300" : "border-mint-500/35 bg-mint-500/10 text-mint-400"}`}
                  >
                    {pending ? <Hourglass className="size-3.5" aria-hidden /> : <BadgeCheck className="size-3.5" aria-hidden />}
                    {pending ? t(S.certs.inProgress) : t(S.certs.earned)}
                  </span>
                </div>
                <h3 className="font-bold leading-snug text-white">{t(c.title)}</h3>
                <p className="mt-1 text-sm text-slate-400">{t(c.issuer)}</p>
                {c.note && <p className="mt-3 text-sm text-slate-300">{t(c.note)}</p>}
              </article>
            );
          })}
        </div>

        <div className="glass mt-6 rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">{t(S.certs.training)}</h3>
          <ul className="flex flex-wrap gap-2">
            {t(trainingCourses).map((x) => (
              <li key={x} className="pill text-slate-200">
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
