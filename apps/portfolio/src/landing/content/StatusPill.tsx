import { CheckCircle2, FlaskConical, PauseCircle } from "lucide-react";
import type { Status } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import { useLang } from "../../i18n/lang";

const STYLE: Record<Status, { cls: string; Icon: typeof CheckCircle2 }> = {
  working: { cls: "border-mint-500/45 bg-mint-500/15 text-mint-400", Icon: CheckCircle2 },
  beta: { cls: "border-gold-400/45 bg-gold-400/15 text-gold-300", Icon: FlaskConical },
  stopped: { cls: "border-slate-400/40 bg-slate-500/20 text-slate-300", Icon: PauseCircle },
};

/** الحالة بأيقونة ونص وليس باللون وحده */
export function StatusPill({ status }: { status: Status }) {
  const { t } = useLang();
  const { cls, Icon } = STYLE[status];
  return (
    <span className={`pill backdrop-blur ${cls}`}>
      <Icon className="size-3.5" aria-hidden />
      {t(C.status[status])}
    </span>
  );
}
