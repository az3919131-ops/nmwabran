import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";
/** نص ثنائي اللغة */
export type Bi<T = string> = { ar: T; en: T };

type LangCtx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  isAr: boolean;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** يختار النص المناسب للغة الحالية */
  t: <T>(v: Bi<T>) => T;
};

const KEY = "nm.lang";
const Ctx = createContext<LangCtx | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {
    /* التخزين قد يكون محجوبًا */
  }
  return "ar"; // العربية الافتراضية
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* تجاهل */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((l) => (l === "ar" ? "en" : "ar")), []);

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      isAr: lang === "ar",
      setLang,
      toggle,
      t: (v) => v[lang],
    }),
    [lang, setLang, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLang must be used inside <LangProvider>");
  return v;
}
