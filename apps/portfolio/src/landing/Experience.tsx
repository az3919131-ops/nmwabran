import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { roles, type Role } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";

const PREVIEW = 2;

function RoleCard({ role, defaultOpen }: { role: Role; defaultOpen: boolean }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const points = t(role.points);
  const extra = points.length > PREVIEW;
  const shown = open ? points : points.slice(0, PREVIEW);

  return (
    <li className="relative ps-9 sm:ps-12">
      {/* عقدة الخط: رمز قاطع؛ ممتلئ للدور الحالي */}
      <span
        className={`absolute start-0 top-6 grid size-[1.1rem] -translate-x-1/2 place-items-center rounded-[4px] border-2 bg-navy-900 rtl:translate-x-1/2 ${
          role.current ? "border-gold-400" : "border-mint-500/70"
        }`}
        aria-hidden
      >
        {role.current && <span className="size-1.5 rounded-[2px] bg-gold-400" />}
      </span>

      <article className="glass rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="tabular font-semibold text-gold-300">{t(role.period)}</span>
          {role.current && <span className="pill border-gold-400/40 bg-gold-400/10 text-gold-300">{t(S.experience.now)}</span>}
        </div>
        <h3 className="mt-1.5 text-xl font-bold text-white">{t(role.title)}</h3>
        <p className="text-slate-300">
          {t(role.org)}
          {role.place && <span className="text-slate-500"> — {t(role.place)}</span>}
        </p>

        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <AnimatePresence initial={false}>
            {shown.map((p, i) => (
              <motion.li
                key={p}
                className="flex gap-2.5"
                initial={i >= PREVIEW && !reduce ? { opacity: 0, height: 0 } : false}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-mint-500" aria-hidden />
                <span>{p}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {extra && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-mint-400 hover:text-mint-300"
          >
            {open ? t(S.experience.collapse) : t(S.experience.expand)}
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </article>
    </li>
  );
}

export function Experience() {
  const { t } = useLang();
  return (
    <section id="experience" aria-labelledby="exp-title" className="section-pad bg-navy-950/60">
      <div className="container-x">
        <SectionHeading id="exp-title" title={t(S.experience.title)} lead={t(S.experience.lead)} />
        <div className="relative max-w-3xl">
          {/* خط التغذية */}
          <span className="absolute inset-y-6 start-0 w-0.5 bg-gradient-to-b from-gold-400 via-mint-500/60 to-transparent" aria-hidden />
          <ol className="space-y-6">
            {roles.map((r, i) => (
              <RoleCard key={r.id} role={r} defaultOpen={i === 0} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
