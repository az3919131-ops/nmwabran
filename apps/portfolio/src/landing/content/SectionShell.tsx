import { Eye, EyeOff, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeading } from "../../components/SectionHeading";
import type { SectionKey } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import { useLang } from "../../i18n/lang";
import { useContent } from "../../lib/ContentContext";
import { setVisible } from "../../lib/contentOps";

/** هيكل القسم: العنوان وأدوات التحرير (إضافة، إظهار/إخفاء). القسم المخفي أو الفارغ لا يُرسم للزوار. */
export function SectionShell({
  id,
  title,
  lead,
  sectionKey,
  visible: visibleProp,
  onToggleVisible,
  empty,
  addLabel,
  onAdd,
  children,
  toolbar,
}: {
  id: string;
  title: string;
  lead?: string;
  /** مفتاح الإظهار/الإخفاء للأقسام الأساسية */
  sectionKey?: SectionKey;
  /** للأقسام المخصصة: تحدد ظهورها وتبدّله بنفسها بدل sectionKey */
  visible?: boolean;
  onToggleVisible?: () => void;
  empty: boolean;
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  const { t } = useLang();
  const { content, editing, update } = useContent();
  const visible = visibleProp ?? (sectionKey ? content.visibility[sectionKey] : true);
  const toggle = onToggleVisible ?? (sectionKey ? () => update((c) => setVisible(c, sectionKey, !visible)) : undefined);
  if (!editing && (!visible || empty)) return null;

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="section-pad">
      <div className="container-x">
        <SectionHeading id={`${id}-title`} title={title} lead={lead} />
        {editing && (
          <div className="-mt-4 mb-8 flex flex-wrap items-center gap-2">
            {onAdd && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
                <Plus className="size-4" aria-hidden />
                {addLabel}
              </button>
            )}
            {toggle && (
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed={!visible} onClick={toggle}>
                {visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4 text-gold-300" aria-hidden />}
                {visible ? t(C.ctl.hideSection) : t(C.ctl.showSection)}
              </button>
            )}
            {toolbar}
            {!visible && <span className="pill border-gold-400/40 bg-gold-400/10 text-gold-300">{t(C.ctl.sectionHidden)}</span>}
          </div>
        )}
        <div className={!visible && editing ? "opacity-55" : ""}>
          {empty && <p className="mb-5 rounded-2xl border border-dashed border-white/20 p-8 text-center text-slate-400">{t(C.ctl.empty)}</p>}
          {children}
        </div>
        {editing && empty && <p className="mt-3 text-sm text-slate-500">{t(C.ctl.emptyHint)}</p>}
      </div>
    </section>
  );
}
