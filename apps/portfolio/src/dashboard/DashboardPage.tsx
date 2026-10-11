import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FlaskConical, LayoutDashboard, MessageSquareText, Plug, RefreshCw, ScrollText, Wifi } from "lucide-react";
import { LogoMark } from "../components/Brand";
import { LangToggle } from "../components/LangToggle";
import { Signature } from "../components/Signature";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n/lang";
import {
  clearKey,
  DashboardError,
  defaultDashboardUrl,
  fetchOverview,
  isDemo,
  loadSession,
  saveDailyMessage,
  saveSession,
  setDemo,
  type DashSession,
  type Overview as OverviewData,
} from "../lib/dashboardApi";
import { computeStats, newestFirst, riyadhDate } from "../lib/stats";
import { AutoReply } from "./AutoReply";
import { ConnectionTab } from "./ConnectionTab";
import { demoOverview } from "./demo";
import { Gate } from "./Gate";
import { Overview } from "./Overview";
import { ReplyLog } from "./ReplyLog";
import { D } from "./strings";

type Mode = "gate" | "live" | "demo";
type TabId = "overview" | "reply" | "log" | "connection";
const TABS: Array<{ id: TabId; icon: typeof LayoutDashboard; label: (typeof D.tabs)["overview"] }> = [
  { id: "overview", icon: LayoutDashboard, label: D.tabs.overview },
  { id: "reply", icon: MessageSquareText, label: D.tabs.reply },
  { id: "log", icon: ScrollText, label: D.tabs.log },
  { id: "connection", icon: Plug, label: D.tabs.connection },
];
const REFRESH_MS = 60_000;

export default function DashboardPage() {
  const { t, isAr } = useLang();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(() => (isDemo() ? "demo" : "gate"));
  const [session, setSession] = useState<DashSession>(loadSession);
  const [data, setData] = useState<OverviewData | null>(() => (isDemo() ? demoOverview() : null));
  const [syncedAt, setSyncedAt] = useState<Date | null>(() => (isDemo() ? new Date() : null));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const toLive = useCallback((s: DashSession, ov: OverviewData) => {
    saveSession(s);
    setDemo(false);
    setSession(s);
    setData(ov);
    setSyncedAt(new Date());
    setMode("live");
  }, []);

  // اتصال تلقائي إن كان الرابط والمفتاح محفوظين من قبل
  useEffect(() => {
    if (mode !== "gate" || !session.url || !session.key) return;
    let cancelled = false;
    fetchOverview(session)
      .then((ov) => !cancelled && toLive(session, ov))
      .catch(() => undefined); // يبقى في شاشة الاتصال ليرى المستخدم الحقول
    return () => {
      cancelled = true;
    };
    // مرة واحدة عند الفتح
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    async (s: DashSession) => {
      const ov = await fetchOverview(s); // يرمي DashboardError ويعرضه النموذج
      toLive(s, ov);
      toast.show("success", t(D.conn.saved));
    },
    [t, toLive, toast],
  );

  const startDemo = () => {
    setDemo(true);
    setData(demoOverview());
    setSyncedAt(new Date());
    setMode("demo");
  };

  const disconnect = () => {
    clearKey();
    setDemo(false);
    setData(null);
    setSyncedAt(null);
    setSession({ url: sessionRef.current.url || defaultDashboardUrl(), key: "", remember: false });
    setMode("gate");
  };

  const refresh = useCallback(
    async (silent = false) => {
      if (mode === "demo") {
        setData((d) => ({ ...demoOverview(), message: d?.message ?? demoOverview().message }));
        setSyncedAt(new Date());
        return;
      }
      if (mode !== "live") return;
      setBusy(true);
      try {
        const ov = await fetchOverview(sessionRef.current);
        setData(ov);
        setSyncedAt(new Date());
      } catch (err) {
        const code = err instanceof DashboardError ? err.code : "network";
        if (code === "unauthorized") setMode("gate");
        if (!silent || code === "unauthorized") toast.show("error", t(D.err[code]));
      } finally {
        setBusy(false);
      }
    },
    [mode, t, toast],
  );

  // تحديث دوري هادئ عندما تكون الصفحة ظاهرة
  useEffect(() => {
    if (mode !== "live") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [mode, refresh]);

  const saveMessage = useCallback(
    async (input: { message: string; enabled: boolean }) => {
      if (mode === "demo") {
        setData((d) => ({ replies: d?.replies ?? [], message: { ...input, updatedOn: riyadhDate() } }));
        toast.show("success", t(D.reply.savedDemo));
        return;
      }
      try {
        const msg = await saveDailyMessage(sessionRef.current, input);
        setData((d) => ({ replies: d?.replies ?? [], message: msg }));
        toast.show("success", t(D.reply.saved));
      } catch (err) {
        const code = err instanceof DashboardError ? err.code : "network";
        if (code === "unauthorized") setMode("gate");
        toast.show("error", t(D.err[code]));
      }
    },
    [mode, t, toast],
  );

  const stats = useMemo(() => computeStats(data?.replies ?? []), [data]);
  const latest = useMemo(() => newestFirst(data?.replies ?? []).slice(0, 5), [data]);

  if (mode === "gate") return <Gate initial={session} onConnect={connect} onDemo={startDemo} />;

  const onKeyTabs = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    // السهم يتبع اتجاه القراءة
    const dir = (e.key === "ArrowRight") === isAr ? -1 : 1;
    const i = TABS.findIndex((x) => x.id === tab);
    const next = TABS[(i + dir + TABS.length) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`dtab-${next.id}`)?.focus();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/85 backdrop-blur-xl">
        <div className="container-x flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-2">
          <a href="#/" className="flex items-center gap-2.5 rounded-lg" aria-label={t(D.back)} title={t(D.back)}>
            <LogoMark size={34} />
            <ArrowLeft className="size-4 text-slate-400 ltr:block rtl:-scale-x-100" aria-hidden />
          </a>
          <div className="me-auto min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-white">{t(D.title)}</h1>
            <p className="truncate text-xs text-slate-400">{t(D.subtitle)}</p>
          </div>
          <span className={`pill ${mode === "live" ? "border-mint-500/40 bg-mint-500/10 text-mint-400" : "border-gold-400/40 bg-gold-400/10 text-gold-300"}`}>
            {mode === "live" ? <Wifi className="size-3.5" aria-hidden /> : <FlaskConical className="size-3.5" aria-hidden />}
            {mode === "live" ? t(D.modeLive) : t(D.modeDemo)}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={busy} aria-label={t(D.refresh)}>
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
            <span className="max-sm:hidden">{busy ? t(D.refreshing) : t(D.refresh)}</span>
          </button>
          <LangToggle />
        </div>
        <div className="container-x">
          <div role="tablist" aria-label={t(D.title)} className="-mb-px flex gap-1 overflow-x-auto" onKeyDown={onKeyTabs}>
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`dtab-${id}`}
                aria-selected={tab === id}
                aria-controls={`dpanel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors ${
                  tab === id ? "border-gold-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {t(label)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container-x py-6" id={`dpanel-${tab}`} role="tabpanel" aria-labelledby={`dtab-${tab}`}>
        {tab === "overview" && <Overview stats={stats} message={data?.message ?? null} latest={latest} onSeeAll={() => setTab("log")} />}
        {tab === "reply" && <AutoReply message={data?.message ?? null} demo={mode === "demo"} onSave={saveMessage} />}
        {tab === "log" && <ReplyLog replies={data?.replies ?? []} />}
        {tab === "connection" && <ConnectionTab mode={mode} session={session} syncedAt={syncedAt} onConnect={connect} onDisconnect={disconnect} />}
      </main>

      <Signature className="pb-10 pt-6" />
    </div>
  );
}
