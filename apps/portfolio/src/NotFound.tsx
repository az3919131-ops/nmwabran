import { Signature } from "./components/Signature";
import { useLang } from "./i18n/lang";
import { S } from "./i18n/strings";

export function NotFound() {
  const { t } = useLang();
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <h1 className="font-display text-4xl text-white">{t(S.notFound.title)}</h1>
        <p className="mt-3 text-slate-400">{t(S.notFound.text)}</p>
        <a href="#/" className="btn btn-primary mt-6">
          {t(S.footer.backToSite)}
        </a>
        <Signature className="mt-16" />
      </div>
    </main>
  );
}
