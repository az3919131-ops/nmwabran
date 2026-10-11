import { Signature } from "../components/Signature";
import { LangToggle } from "../components/LangToggle";
import { LogoMark } from "../components/Brand";
import { useLang } from "../i18n/lang";
import type { DashSession } from "../lib/dashboardApi";
import { ConnectionForm } from "./ConnectionForm";
import { SetupSteps } from "./SetupSteps";
import { D } from "./strings";

export function Gate({ initial, onConnect, onDemo }: { initial: DashSession; onConnect: (s: DashSession) => Promise<void>; onDemo: () => void }) {
  const { t } = useLang();
  return (
    <div className="min-h-screen">
      <header className="container-x flex h-16 items-center justify-between">
        <a href="#/" className="flex items-center gap-2.5 rounded-lg" aria-label={t(D.back)}>
          <LogoMark size={34} />
          <span className="text-sm font-semibold text-slate-300">{t(D.back)}</span>
        </a>
        <LangToggle />
      </header>

      <main className="container-x grid gap-6 pb-16 pt-6 lg:grid-cols-5">
        <section className="glass rounded-2xl p-5 sm:p-8 lg:col-span-3" aria-labelledby="gate-title">
          <h1 id="gate-title" className="font-display text-2xl text-white sm:text-3xl">
            {t(D.gate.title)}
          </h1>
          <p className="mb-6 mt-2 text-slate-400">{t(D.gate.lead)}</p>
          <ConnectionForm
            initial={initial}
            submitLabel={t(D.gate.connect)}
            busyLabel={t(D.gate.connecting)}
            onSubmit={onConnect}
            extra={
              <button type="button" className="btn btn-ghost" onClick={onDemo}>
                {t(D.gate.demo)}
              </button>
            }
          />
          <p className="mt-3 text-xs text-slate-500">{t(D.gate.demoHint)}</p>
        </section>
        <aside className="glass h-fit rounded-2xl p-5 sm:p-6 lg:col-span-2">
          <h2 className="mb-4 font-bold text-white">{t(D.gate.setup)}</h2>
          <SetupSteps />
        </aside>
      </main>
      <Signature className="pb-10" />
    </div>
  );
}
