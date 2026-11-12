import { ClipboardCopy, Download, HelpCircle, LogOut, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { config } from "../../config";
import { C } from "../../i18n/content-strings";
import { useLang } from "../../i18n/lang";
import { useContent } from "../../lib/ContentContext";
import { downloadText } from "../../lib/vcard";

function PublishHelp({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const steps = [C.edit.help.s1, C.edit.help.s2, C.edit.help.s3];
  return (
    <Modal open onClose={onClose} title={t(C.edit.help.title)}>
      <ol className="space-y-3 text-sm text-slate-300">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-gold-400/40 bg-gold-400/10 text-xs font-bold text-gold-300">{i + 1}</span>
            <span>{t(s)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/10 p-3 text-sm text-gold-300">{t(C.edit.help.note)}</p>
      <a className="btn btn-primary mt-5" href={config.contentEditUrl} target="_blank" rel="noopener noreferrer">
        {t(C.edit.help.open)}
      </a>
    </Modal>
  );
}

/** شريط وضع التحرير السفلي: حالة المسودة، نسخ/تنزيل المحتوى، تجاهل المسودة، الخروج */
export function EditBar() {
  const { t } = useLang();
  const toast = useToast();
  const { dirty, discard, exportJson } = useContent();
  const [help, setHelp] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const id = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(id);
  }, [confirm]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson());
      toast.show("success", t(C.edit.copied));
    } catch {
      toast.show("error", t(C.edit.copyFailed));
    }
  };

  return (
    <>
      <div className="no-print fixed inset-x-0 bottom-0 z-[60] border-t border-gold-400/40 bg-navy-950/95 backdrop-blur-xl" role="region" aria-label={t(C.edit.mode)}>
        <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
          <span className="pill border-gold-400/50 bg-gold-400/10 text-gold-300">
            <PencilLine className="size-3.5" aria-hidden />
            {t(C.edit.mode)}
          </span>
          <span className={`text-sm ${dirty ? "text-gold-300" : "text-slate-400"}`} role="status">
            {dirty ? t(C.edit.unpublished) : t(C.edit.clean)}
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
              <ClipboardCopy className="size-4" aria-hidden />
              {t(C.edit.copy)}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText("site-content.json", "application/json", exportJson())}>
              <Download className="size-4" aria-hidden />
              {t(C.edit.download)}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHelp(true)}>
              <HelpCircle className="size-4" aria-hidden />
              {t(C.edit.how)}
            </button>
            {dirty &&
              (confirm ? (
                <button type="button" className="btn btn-sm bg-red-500 text-white hover:bg-red-400" onClick={() => { discard(); setConfirm(false); }}>
                  {t(C.edit.discardConfirm)}
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>
                  {t(C.edit.discard)}
                </button>
              ))}
            <a href="#/" className="btn btn-ghost btn-sm">
              <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
              {t(C.edit.exit)}
            </a>
          </div>
        </div>
      </div>
      {help && <PublishHelp onClose={() => setHelp(false)} />}
    </>
  );
}

/** للمالك فقط: إن وُجدت مسودة غير منشورة تظهر شارة صغيرة خارج وضع التحرير */
export function DraftChip() {
  const { t } = useLang();
  const { dirty, editing } = useContent();
  if (!dirty || editing) return null;
  return (
    <a href="#/edit" className="no-print fixed bottom-4 start-4 z-[55] flex items-center gap-2 rounded-full border border-gold-400/50 bg-navy-950/95 px-4 py-2 text-sm font-semibold text-gold-300 shadow-lg backdrop-blur hover:bg-navy-900">
      <PencilLine className="size-4" aria-hidden />
      {t(C.edit.draftChip)} · {t(C.edit.draftContinue)}
    </a>
  );
}
