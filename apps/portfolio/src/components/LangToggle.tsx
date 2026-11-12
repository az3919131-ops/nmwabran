import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";

/** مفتاح تبديل اللغة: العربية | English (يضبط dir تلقائيًا من LangProvider) */
export function LangToggle() {
  const { lang, setLang, t } = useLang();
  const item = (code: "ar" | "en", label: string) => (
    <button
      type="button"
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
      lang={code}
      className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
        lang === code ? "bg-white text-navy-900" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t(S.footer.langSwitch)} className="flex rounded-xl border border-white/15 bg-white/5 p-0.5">
      {item("ar", "العربية")}
      {item("en", "English")}
    </div>
  );
}
