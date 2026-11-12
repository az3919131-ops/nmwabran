import { ArrowDown, ArrowUp, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CardKind, CustomCard, CustomSection } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import { useLang } from "../../i18n/lang";
import { hostOf, newId, pick } from "../../lib/content";
import { useContent } from "../../lib/ContentContext";
import { addCard, addSection, moveCard, moveSection, removeCard, removeSection, toggleCardHidden, updateCard, updateSection } from "../../lib/contentOps";
import { HiddenBadge, ItemControls } from "./EditControls";
import { cardFields, SECTION_FIELDS } from "./fields";
import { ItemForm } from "./ItemForm";
import { SectionShell } from "./SectionShell";

const empty = { ar: "", en: "" };
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** محتوى بطاقة بحسب شكل القسم: رابط، نص، صورة، ملف */
function CardBody({ card, kind }: { card: CustomCard; kind: CardKind }) {
  const { t, lang } = useLang();
  const title = pick(card.title, lang);
  const body = pick(card.body, lang);
  const open = (href: string, label: string) => (
    <a className="btn btn-ghost btn-sm" href={href} target="_blank" rel="noopener noreferrer">
      <ExternalLink className="size-4" aria-hidden />
      {label}
      <span className="sr-only"> — {title}</span>
    </a>
  );
  switch (kind) {
    case "text":
      return (
        <>
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
            {title}
            {card.hidden && <HiddenBadge />}
          </h3>
          {body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{body}</p>}
        </>
      );
    case "image": {
      const img = card.imageUrl ? <img src={card.imageUrl} alt={title} loading="lazy" referrerPolicy="no-referrer" className="aspect-[4/3] w-full rounded-xl object-cover" /> : null;
      return (
        <>
          {img && (card.url ? <a href={card.url} target="_blank" rel="noopener noreferrer" aria-label={title}>{img}</a> : img)}
          <h3 className="mt-3 flex flex-wrap items-center gap-2 font-bold text-white">
            {title}
            {card.hidden && <HiddenBadge />}
          </h3>
          {body && <p className="mt-1 text-sm text-slate-400">{body}</p>}
        </>
      );
    }
    case "file":
      return (
        <>
          <span className="grid size-11 place-items-center rounded-xl bg-white/6 text-gold-300 ring-1 ring-white/10">
            <FileText className="size-5" aria-hidden />
          </span>
          <h3 className="mt-3 flex flex-wrap items-center gap-2 font-bold text-white">
            {title}
            {card.fileType && <span className="pill border-white/15 text-slate-300" dir="ltr">{card.fileType}</span>}
            {card.hidden && <HiddenBadge />}
          </h3>
          {body && <p className="mt-1.5 text-sm text-slate-400">{body}</p>}
          {card.url && <div className="mt-auto pt-4">{open(card.url, t(C.custom.openFile))}</div>}
        </>
      );
    default:
      return (
        <>
          <h3 className="flex flex-wrap items-center gap-2 font-bold text-white">
            {title}
            {card.hidden && <HiddenBadge />}
          </h3>
          {body && <p className="mt-1.5 text-sm text-slate-400">{body}</p>}
          {card.url && (
            <>
              <p className="mt-2 truncate text-sm text-slate-500" dir="ltr">{hostOf(card.url)}</p>
              <div className="mt-auto pt-4">{open(card.url, t(C.pages.open))}</div>
            </>
          )}
        </>
      );
  }
}

function SectionToolbar({ section, onEdit }: { section: CustomSection; onEdit: () => void }) {
  const { t } = useLang();
  const { update } = useContent();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(id);
  }, [confirming]);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
        <Pencil className="size-4" aria-hidden />
        {t(C.custom.editSection)}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => update((c) => moveSection(c, section.id, -1))} aria-label={t(C.ctl.earlier)} title={t(C.ctl.earlier)}>
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => update((c) => moveSection(c, section.id, 1))} aria-label={t(C.ctl.later)} title={t(C.ctl.later)}>
        <ArrowDown className="size-4" aria-hidden />
      </button>
      {confirming ? (
        <button type="button" className="btn btn-sm bg-red-500 text-white hover:bg-red-400" onClick={() => update((c) => removeSection(c, section.id))}>
          {t(C.ctl.removeConfirm)}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm hover:!text-red-300" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden />
          {t(C.form.deleteSection)}
        </button>
      )}
    </>
  );
}

function CustomSectionView({ section }: { section: CustomSection }) {
  const { t, lang } = useLang();
  const { editing, update } = useContent();
  const [cardEd, setCardEd] = useState<{ id?: string } | null>(null);
  const [sectionEd, setSectionEd] = useState(false);
  const cards = editing ? section.cards : section.cards.filter((c) => !c.hidden);
  const current = cardEd?.id ? section.cards.find((c) => c.id === cardEd.id) : undefined;

  const submitCard = (values: Record<string, unknown>) => {
    if (cardEd?.id) update((c) => updateCard(c, section.id, cardEd.id!, values as Partial<CustomCard>));
    else update((c) => addCard(c, section.id, { ...(clean(values) as Omit<CustomCard, "id">), id: newId("card") }));
    setCardEd(null);
  };
  const submitSection = (values: Record<string, unknown>) => {
    update((c) => updateSection(c, section.id, { title: values.title as CustomSection["title"], kind: values.kind as CardKind, visible: values.visible === true }));
    setSectionEd(false);
  };

  const grid = section.kind === "text" ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <SectionShell
      id={`custom-${section.id}`}
      title={pick(section.title, lang)}
      visible={section.visible}
      onToggleVisible={() => update((c) => updateSection(c, section.id, { visible: !section.visible }))}
      empty={cards.length === 0}
      addLabel={t(C.custom.addCard)}
      onAdd={() => setCardEd({})}
      toolbar={<SectionToolbar section={section} onEdit={() => setSectionEd(true)} />}
    >
      <div className={`grid gap-5 ${grid}`}>
        {cards.map((card) => (
          <article key={card.id} className={`glass relative flex flex-col rounded-2xl p-5 ${card.hidden ? "opacity-60" : ""}`}>
            <ItemControls
              hidden={card.hidden}
              onEdit={() => setCardEd({ id: card.id })}
              onToggleHidden={() => update((c) => toggleCardHidden(c, section.id, card.id))}
              onDelete={() => update((c) => removeCard(c, section.id, card.id))}
              onMove={(d) => update((c) => moveCard(c, section.id, card.id, d))}
            />
            <CardBody card={card} kind={section.kind} />
          </article>
        ))}
      </div>
      {cardEd && (
        <ItemForm title={t(cardEd.id ? C.custom.editCard : C.custom.addCard)} fields={cardFields(section.kind)} initial={(current ?? { title: empty }) as unknown as Record<string, unknown>} onSubmit={submitCard} onClose={() => setCardEd(null)} />
      )}
      {sectionEd && <ItemForm title={t(C.custom.editSection)} fields={SECTION_FIELDS} initial={{ title: section.title, kind: section.kind, visible: section.visible }} onSubmit={submitSection} onClose={() => setSectionEd(false)} />}
    </SectionShell>
  );
}

/** الأقسام المخصصة + زر «إنشاء قسم جديد» (في وضع التحرير فقط) */
export function CustomSections() {
  const { t } = useLang();
  const { content, editing, update } = useContent();
  const [creating, setCreating] = useState(false);
  const sections = content.custom.filter((s) => editing || (s.visible && s.cards.some((c) => !c.hidden)));

  return (
    <>
      {sections.map((s) => (
        <CustomSectionView key={s.id} section={s} />
      ))}
      {editing && (
        <section aria-label={t(C.custom.newSection)} className="pb-10">
          <div className="container-x">
            <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gold-400/50 p-6 font-semibold text-gold-300 transition-colors hover:bg-gold-400/10" onClick={() => setCreating(true)}>
              <Plus className="size-5" aria-hidden />
              {t(C.custom.newSection)}
            </button>
          </div>
          {creating && (
            <ItemForm
              title={t(C.custom.newSection)}
              fields={SECTION_FIELDS}
              initial={{ title: empty, kind: "link", visible: true }}
              onSubmit={(v) => {
                update((c) => addSection(c, { id: newId("cs"), title: v.title as CustomSection["title"], kind: v.kind as CardKind, visible: v.visible === true, cards: [] }));
                setCreating(false);
              }}
              onClose={() => setCreating(false)}
            />
          )}
        </section>
      )}
    </>
  );
}
