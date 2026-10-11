import { ExternalLink } from "lucide-react";
import { useLang, type Bi } from "../i18n/lang";
import { META_APPS_URL, n8nLinks } from "../lib/n8nLinks";
import { D } from "./strings";

const CONTRACT = `POST  {webhook URL}
x-dashboard-key: <المفتاح السري>
Content-Type: application/json

{ "action": "overview" }
{ "action": "save_message", "message": "…", "enabled": "نعم" | "لا" }`;

type Step = { text: Bi; links: Array<{ href: string; label: Bi }> };

/** خطوات تفعيل الربط: تسلسل فعلي فيُرقَّم، وتحت كل خطوة روابط فتح مباشرة */
export function SetupSteps({ withContract = false }: { withContract?: boolean }) {
  const { t } = useLang();
  const l = n8nLinks();
  const steps: Step[] = [
    { text: D.conn.steps.publish, links: l ? [{ href: l.dashboardWorkflow, label: D.conn.links.dashboardWorkflow }] : [] },
    { text: D.conn.steps.key, links: l ? [{ href: l.dataTables, label: D.conn.links.dataTables }] : [] },
    {
      text: D.conn.steps.whatsapp,
      links: [
        ...(l
          ? [
              { href: l.credentials, label: D.conn.links.credentials },
              { href: l.autoReplyWorkflow, label: D.conn.links.autoReplyWorkflow },
            ]
          : []),
        { href: META_APPS_URL, label: D.conn.links.meta },
      ],
    },
    { text: D.conn.steps.connect, links: [] },
  ];
  return (
    <div>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-slate-300">
            <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-gold-400/40 bg-gold-400/10 text-xs font-bold text-gold-300">{i + 1}</span>
            <div className="min-w-0">
              <p>{t(s.text)}</p>
              {s.links.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {s.links.map((k) => (
                    <li key={k.href}>
                      <a className="btn btn-ghost btn-sm" href={k.href} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" aria-hidden />
                        {t(k.label)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      {withContract && (
        <details className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-300">{t(D.conn.contract)}</summary>
          <pre dir="ltr" className="mt-2 overflow-x-auto text-xs leading-relaxed text-mint-400">
            {CONTRACT}
          </pre>
        </details>
      )}
    </div>
  );
}
