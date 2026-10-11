import { Download, MapPin, MessageCircle } from "lucide-react";
import { Counter } from "../components/Counter";
import { useToast } from "../components/Toast";
import { metrics, person } from "../data/profile";
import { useLang } from "../i18n/lang";
import { S } from "../i18n/strings";
import { downloadVCard } from "../lib/vcard";
import { waLink } from "../lib/whatsapp";
import { SingleLineDiagram } from "./SingleLineDiagram";

export function Hero() {
  const { t, lang } = useLang();
  const toast = useToast();

  return (
    <section id="top" className="relative isolate overflow-hidden bg-navy-900">
      {/* على الجوال: المخطط خلفية خافتة جدًا؛ وعلى الشاشات الكبيرة يظهر كاملًا بجانب البطاقة */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] lg:hidden" aria-hidden>
        <SingleLineDiagram className="size-full" />
      </div>
      <div className="pointer-events-none absolute -top-40 start-1/2 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-mint-500/10 blur-3xl" aria-hidden />

      <div className="container-x pb-14 pt-28 sm:pt-32">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="glass rounded-2xl p-6 sm:p-10">
          <p className="pill mb-6 border-mint-500/40 bg-mint-500/10 text-mint-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-mint-400" />
            </span>
            {t(person.badge)}
          </p>

          <div className="flex items-center gap-4 sm:gap-6">
            <img
              src={`${import.meta.env.BASE_URL}ahmed.jpg`}
              width={112}
              height={112}
              alt={t(S.hero.portrait)}
              className="size-20 shrink-0 rounded-full object-cover ring-2 ring-gold-400 ring-offset-4 ring-offset-navy-900 sm:size-28"
            />
            <div>
              <h1 className="font-display text-3xl leading-tight text-white sm:text-4xl xl:text-5xl">{t(person.name)}</h1>
              <p className="mt-1.5 text-base font-semibold text-gold-300 sm:text-xl">{t(person.title)}</p>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">{t(person.summary)}</p>
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <MapPin className="size-4 text-mint-400" aria-hidden />
            {t(person.location)}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className="btn btn-primary"
              href={waLink(t(S.hero.greeting))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-5" aria-hidden />
              {t(S.actions.whatsapp)}
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                downloadVCard(lang);
                toast.show("success", t(S.actions.saved));
              }}
            >
              <Download className="size-5" aria-hidden />
              {t(S.actions.saveContact)}
            </button>
          </div>
        </div>

        <div className="hidden lg:block" aria-hidden>
          <SingleLineDiagram className="mx-auto h-auto max-h-[34rem] w-full" />
        </div>
        </div>

        {/* شريط الأرقام: قضيب توزيع ذهبي تتفرع منه القيم */}
        <div role="list" aria-label={t(S.hero.metrics)} className="mt-12 grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label.en} role="listitem" className="relative border-t-[3px] border-gold-400/70 px-1 pb-2 pe-3 pt-6">
              <span className="absolute start-1 top-0 h-3.5 w-px bg-gold-400/80" aria-hidden />
              <p className="font-display text-4xl text-white sm:text-5xl">
                <Counter value={m.value} prefix={m.prefix} suffix={m.suffix} decimals={m.decimals} />
              </p>
              <p className="mt-1 text-sm text-slate-400">{t(m.label)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
