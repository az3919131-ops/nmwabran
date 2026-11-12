import { ExternalLink } from "lucide-react";
import { Modal } from "../../components/Modal";
import { C } from "../../i18n/content-strings";
import { useLang } from "../../i18n/lang";

/** معاينة مضمنة كبيرة؛ تُستعمل فقط للمنصات التي حدّد صاحبها أنها تسمح بالعرض داخل إطار. */
export function PreviewModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const { t } = useLang();
  return (
    <Modal open onClose={onClose} title={`${t(C.platforms.previewTitle)} — ${name}`} wide>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white">
        <iframe title={name} src={url} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" className="block h-[60vh] w-full" />
      </div>
      <p className="mt-3 text-sm text-slate-400">{t(C.platforms.previewNote)}</p>
      <a className="btn btn-primary mt-4" href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" aria-hidden />
        {t(C.platforms.open)}
      </a>
    </Modal>
  );
}
