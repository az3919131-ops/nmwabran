import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { C } from "../../i18n/content-strings";
import { useLang } from "../../i18n/lang";
import { useContent } from "../../lib/ContentContext";

/** أزرار تحرير عنصر واحد (تعديل، إخفاء، نقل، حذف بخطوتين). لا تظهر إلا في وضع التحرير. */
export function ItemControls({ hidden, onEdit, onToggleHidden, onDelete, onMove }: { hidden?: boolean; onEdit: () => void; onToggleHidden: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void }) {
  const { editing } = useContent();
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(id);
  }, [confirming]);

  if (!editing) return null;
  const btn = "grid size-8 place-items-center rounded-md text-slate-300 transition-colors hover:bg-white/12 hover:text-white";
  return (
    <div className="absolute end-2 top-2 z-10 flex items-center gap-0.5 rounded-lg bg-navy-950/92 p-1 ring-1 ring-white/15" role="group" aria-label={t(C.edit.mode)}>
      <button type="button" className={btn} onClick={() => onMove(-1)} aria-label={t(C.ctl.earlier)} title={t(C.ctl.earlier)}>
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={btn} onClick={() => onMove(1)} aria-label={t(C.ctl.later)} title={t(C.ctl.later)}>
        <ArrowDown className="size-4" aria-hidden />
      </button>
      <button type="button" className={btn} onClick={onToggleHidden} aria-pressed={hidden === true} aria-label={hidden ? t(C.ctl.show) : t(C.ctl.hide)} title={hidden ? t(C.ctl.show) : t(C.ctl.hide)}>
        {hidden ? <EyeOff className="size-4 text-gold-300" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
      <button type="button" className={btn} onClick={onEdit} aria-label={t(C.ctl.edit)} title={t(C.ctl.edit)}>
        <Pencil className="size-4" aria-hidden />
      </button>
      {confirming ? (
        <button type="button" className="rounded-md bg-red-500/90 px-2 py-1.5 text-xs font-bold text-white" onClick={onDelete}>
          {t(C.ctl.removeConfirm)}
        </button>
      ) : (
        <button type="button" className={`${btn} hover:!text-red-300`} onClick={() => setConfirming(true)} aria-label={t(C.ctl.remove)} title={t(C.ctl.remove)}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function HiddenBadge() {
  const { t } = useLang();
  return (
    <span className="pill border-gold-400/40 bg-navy-950/90 text-gold-300">
      <EyeOff className="size-3.5" aria-hidden />
      {t(C.hidden)}
    </span>
  );
}
