import { Mail, MessageCircle } from "lucide-react";
import { LinkedInIcon } from "../components/Brand";
import { Signature } from "../components/Signature";
import { config } from "../config";
import { person } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { waLink } from "../lib/whatsapp";

export function Footer() {
  const { t } = useLang();
  const year = new Date().getFullYear();
  const social = "grid size-10 place-items-center rounded-xl border border-white/12 bg-white/5 text-slate-300 transition-colors hover:border-mint-500/50 hover:text-mint-400";

  return (
    <footer className="border-t border-white/10 bg-navy-950 pb-10 pt-12">
      <div className="container-x flex flex-col items-center gap-6">
        <ul className="flex items-center gap-3">
          <li>
            <a className={social} href={waLink("")} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <MessageCircle className="size-5" aria-hidden />
            </a>
          </li>
          <li>
            <a className={social} href={`mailto:${config.email}`} aria-label={t(S.contact.email)}>
              <Mail className="size-5" aria-hidden />
            </a>
          </li>
          <li>
            <a className={social} href={config.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <LinkedInIcon className="size-5" />
            </a>
          </li>
        </ul>

        <p className="text-sm text-slate-400">
          © <span className="tabular">{year}</span> {t(person.name)} — {t(S.footer.rights)}
        </p>
        <a href="#/dashboard" className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">
          {t(S.footer.dashboard)}
        </a>
        <Signature />
      </div>
    </footer>
  );
}
