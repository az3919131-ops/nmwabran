import { CheckCircle2, FlaskConical, LogOut } from "lucide-react";
import { useLang } from "../i18n/lang";
import type { DashSession } from "../lib/dashboardApi";
import { formatDateTime } from "../lib/format";
import { ConnectionForm } from "./ConnectionForm";
import { SetupSteps } from "./SetupSteps";
import { D } from "./strings";

export function ConnectionTab({
  mode,
  session,
  syncedAt,
  onConnect,
  onDisconnect,
}: {
  mode: "live" | "demo";
  session: DashSession;
  syncedAt: Date | null;
  onConnect: (s: DashSession) => Promise<void>;
  onDisconnect: () => void;
}) {
  const { t, lang } = useLang();
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="glass rounded-2xl p-4 sm:p-6 lg:col-span-3">
        <h2 className="text-xl font-bold text-white">{t(D.conn.title)}</h2>
        <p className="mb-5 mt-1 text-sm text-slate-400">{t(D.conn.lead)}</p>

        <p className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <span className="text-slate-400">{t(D.conn.status)}:</span>
          {mode === "live" ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-mint-400">
              <CheckCircle2 className="size-4" aria-hidden />
              {t(D.modeLive)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-gold-300">
              <FlaskConical className="size-4" aria-hidden />
              {t(D.modeDemo)}
            </span>
          )}
          {syncedAt && (
            <span className="text-slate-500">
              · {t(D.lastSync)}: {formatDateTime(syncedAt.toISOString(), lang)}
            </span>
          )}
        </p>

        <ConnectionForm
          key={`${mode}-${session.url}`}
          initial={session}
          submitLabel={t(D.conn.save)}
          busyLabel={t(D.gate.connecting)}
          onSubmit={onConnect}
          extra={
            <button type="button" className="btn btn-ghost" onClick={onDisconnect}>
              <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
              {t(D.disconnect)}
            </button>
          }
        />
      </div>
      <aside className="glass h-fit rounded-2xl p-4 sm:p-6 lg:col-span-2">
        <h3 className="mb-4 font-bold text-white">{t(D.gate.setup)}</h3>
        <SetupSteps withContract />
      </aside>
    </div>
  );
}
