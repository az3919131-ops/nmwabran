import { useState, type KeyboardEvent } from "react";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { LinkedInIcon } from "../components/Brand";
import { SectionHeading } from "../components/SectionHeading";
import { config, formatPhone } from "../config";
import { person } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { loadOverrides, type N8nOverrides } from "../lib/n8n";
import { waLink } from "../lib/whatsapp";
import { N8nReviewForm } from "./N8nReviewForm";
import { N8nSettingsModal } from "./N8nSettingsModal";
import { WhatsappForm } from "./WhatsappForm";

const TABS = ["whatsapp", "n8n"] as const;
type Tab = (typeof TABS)[number];

export function Contact() {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overrides, setOverrides] = useState<N8nOverrides>(loadOverrides);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + 1) % TABS.length]!;
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`panel-${id}`}
      tabIndex={tab === id ? 0 : -1}
      onKeyDown={onKey}
      onClick={() => setTab(id)}
      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors sm:text-base ${
        tab === id ? "bg-mint-500 text-[#04231a]" : "text-slate-300 hover:bg-white/8"
      }`}
    >
      {label}
    </button>
  );

  const item = "flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5";
  const ico = "mt-0.5 size-5 shrink-0 text-mint-400";

  return (
    <section id="contact" aria-labelledby="contact-title" className="section-pad">
      <div className="container-x">
        <SectionHeading id="contact-title" title={t(S.contact.title)} lead={t(S.contact.lead)} />

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="glass h-fit rounded-2xl p-3 lg:col-span-2">
            <ul>
              <li>
                <a className={item} href={waLink("")} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className={ico} aria-hidden />
                  <span>
                    <span className="block text-sm text-slate-400">{t(S.contact.phone)}</span>
                    <span className="tabular font-semibold text-white" dir="ltr">
                      {formatPhone(config.whatsappNumber)}
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a className={item} href={`mailto:${config.email}`}>
                  <Mail className={ico} aria-hidden />
                  <span>
                    <span className="block text-sm text-slate-400">{t(S.contact.email)}</span>
                    <span className="font-semibold text-white">{config.email}</span>
                  </span>
                </a>
              </li>
              <li>
                <a className={item} href={config.linkedin} target="_blank" rel="noopener noreferrer">
                  <LinkedInIcon className={ico} />
                  <span>
                    <span className="block text-sm text-slate-400">{t(S.contact.linkedin)}</span>
                    <span className="font-semibold text-white" dir="ltr">
                      ahmed-zahran
                    </span>
                  </span>
                </a>
              </li>
              <li className={item}>
                <MapPin className={ico} aria-hidden />
                <span>
                  <span className="block text-sm text-slate-400">{t(S.contact.location)}</span>
                  <span className="font-semibold text-white">{t(person.location)}</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-6 lg:col-span-3">
            <div role="tablist" aria-label={t(S.contact.title)} className="mb-6 flex gap-1 rounded-2xl bg-black/25 p-1">
              {tabBtn("whatsapp", t(S.contact.tabWhatsapp))}
              {tabBtn("n8n", t(S.contact.tabN8n))}
            </div>
            <div role="tabpanel" id="panel-whatsapp" aria-labelledby="tab-whatsapp" hidden={tab !== "whatsapp"}>
              {tab === "whatsapp" && <WhatsappForm />}
            </div>
            <div role="tabpanel" id="panel-n8n" aria-labelledby="tab-n8n" hidden={tab !== "n8n"}>
              {tab === "n8n" && <N8nReviewForm overrides={overrides} onOpenSettings={() => setSettingsOpen(true)} />}
            </div>
          </div>
        </div>
      </div>
      <N8nSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} overrides={overrides} onChange={setOverrides} />
    </section>
  );
}
