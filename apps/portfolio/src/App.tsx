import { lazy, Suspense, useEffect } from "react";
import { ToastProvider } from "./components/Toast";
import { LangProvider } from "./i18n/lang";
import { Landing } from "./landing/Landing";
import { NotFound } from "./NotFound";
import { useRoute } from "./lib/useRoute";

// اللوحة تُحمَّل عند الحاجة فقط، فلا تثقل الصفحة الرئيسية على زوار الموقع
const DashboardPage = lazy(() => import("./dashboard/DashboardPage"));

function Routes() {
  const route = useRoute();

  useEffect(() => {
    if (route.name === "home" && !window.location.hash) window.scrollTo({ top: 0 });
    if (route.name === "dashboard") window.scrollTo({ top: 0 });
  }, [route.name]);

  if (route.name === "dashboard")
    return (
      <Suspense fallback={<div className="grid min-h-screen place-items-center text-slate-400">…</div>}>
        <DashboardPage />
      </Suspense>
    );
  if (route.name === "not-found") return <NotFound />;
  return <Landing />;
}

export function App() {
  return (
    <LangProvider>
      <ToastProvider>
        <Routes />
      </ToastProvider>
    </LangProvider>
  );
}
