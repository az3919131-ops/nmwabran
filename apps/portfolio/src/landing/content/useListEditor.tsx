import { useState } from "react";
import type { ItemOf, ListKey } from "../../data/content-types";
import { newId } from "../../lib/content";
import { useContent } from "../../lib/ContentContext";
import { addItem, moveItem, removeItem, toggleHidden, updateItem } from "../../lib/contentOps";
import { ItemControls } from "./EditControls";

const stripUndefined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** منطق الإضافة والتعديل والحذف والنقل والإخفاء المشترك بين الأقسام القائمة على قوائم */
export function useListEditor<K extends ListKey>(key: K, prefix: string, defaults: () => Omit<ItemOf<K>, "id">) {
  const { content, editing, update } = useContent();
  const [state, setState] = useState<{ id?: string } | null>(null);
  const items = content[key] as unknown as Array<ItemOf<K>>;
  const shown = editing ? items : items.filter((i) => !i.hidden);
  const current = state?.id ? items.find((i) => i.id === state.id) : undefined;
  const initial: Record<string, unknown> | null = state ? ((current ?? defaults()) as unknown as Record<string, unknown>) : null;

  const submit = (values: Record<string, unknown>) => {
    if (state?.id) update((c) => updateItem(c, key, state.id!, values as Partial<ItemOf<K>>));
    else update((c) => addItem(c, key, { ...defaults(), ...stripUndefined(values), id: newId(prefix) } as ItemOf<K>));
    setState(null);
  };

  const controls = (item: ItemOf<K>) => (
    <ItemControls
      hidden={item.hidden}
      onEdit={() => setState({ id: item.id })}
      onToggleHidden={() => update((c) => toggleHidden(c, key, item.id))}
      onDelete={() => update((c) => removeItem(c, key, item.id))}
      onMove={(d) => update((c) => moveItem(c, key, item.id, d))}
    />
  );

  return { items, shown, editing, initial, editingId: state?.id, open: () => setState({}), edit: (id: string) => setState({ id }), close: () => setState(null), isOpen: state !== null, submit, controls };
}
