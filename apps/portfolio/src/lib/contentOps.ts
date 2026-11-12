import type { CustomCard, CustomSection, ItemOf, ListKey, SectionKey, SiteContent } from "../data/content-types";

// عمليات نقية على المحتوى (لا تعدّل الأصل): تُستعمل من وضع التحرير ويغطيها الاختبار.

type Item = { id: string; hidden?: boolean };
const list = (c: SiteContent, key: ListKey) => c[key] as unknown as Item[];
const withList = (c: SiteContent, key: ListKey, next: Item[]): SiteContent => ({ ...c, [key]: next }) as SiteContent;

export function swap<T extends { id: string }>(items: T[], id: string, dir: -1 | 1): T[] {
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export const addItem = <K extends ListKey>(c: SiteContent, key: K, item: ItemOf<K>): SiteContent => withList(c, key, [...list(c, key), item as unknown as Item]);
export const updateItem = <K extends ListKey>(c: SiteContent, key: K, id: string, patch: Partial<ItemOf<K>>): SiteContent =>
  withList(c, key, list(c, key).map((x) => (x.id === id ? { ...x, ...(patch as object) } : x)));
export const removeItem = (c: SiteContent, key: ListKey, id: string): SiteContent => withList(c, key, list(c, key).filter((x) => x.id !== id));
export const moveItem = (c: SiteContent, key: ListKey, id: string, dir: -1 | 1): SiteContent => withList(c, key, swap(list(c, key), id, dir));
export const toggleHidden = (c: SiteContent, key: ListKey, id: string): SiteContent =>
  withList(c, key, list(c, key).map((x) => (x.id === id ? (x.hidden ? { id: x.id, ...omitHidden(x) } : { ...x, hidden: true }) : x)));
const omitHidden = (x: Item) => {
  const { hidden: _h, id: _i, ...rest } = x;
  return rest;
};

export const setVisible = (c: SiteContent, key: SectionKey, visible: boolean): SiteContent => ({ ...c, visibility: { ...c.visibility, [key]: visible } });

// ───── الأقسام المخصصة وبطاقاتها ─────
const mapSection = (c: SiteContent, id: string, fn: (s: CustomSection) => CustomSection): SiteContent => ({ ...c, custom: c.custom.map((s) => (s.id === id ? fn(s) : s)) });

export const addSection = (c: SiteContent, s: CustomSection): SiteContent => ({ ...c, custom: [...c.custom, s] });
export const updateSection = (c: SiteContent, id: string, patch: Partial<Omit<CustomSection, "id" | "cards">>): SiteContent => mapSection(c, id, (s) => ({ ...s, ...patch }));
export const removeSection = (c: SiteContent, id: string): SiteContent => ({ ...c, custom: c.custom.filter((s) => s.id !== id) });
export const moveSection = (c: SiteContent, id: string, dir: -1 | 1): SiteContent => ({ ...c, custom: swap(c.custom, id, dir) });

export const addCard = (c: SiteContent, sectionId: string, card: CustomCard): SiteContent => mapSection(c, sectionId, (s) => ({ ...s, cards: [...s.cards, card] }));
export const updateCard = (c: SiteContent, sectionId: string, cardId: string, patch: Partial<CustomCard>): SiteContent =>
  mapSection(c, sectionId, (s) => ({ ...s, cards: s.cards.map((x) => (x.id === cardId ? { ...x, ...patch } : x)) }));
export const removeCard = (c: SiteContent, sectionId: string, cardId: string): SiteContent => mapSection(c, sectionId, (s) => ({ ...s, cards: s.cards.filter((x) => x.id !== cardId) }));
export const moveCard = (c: SiteContent, sectionId: string, cardId: string, dir: -1 | 1): SiteContent => mapSection(c, sectionId, (s) => ({ ...s, cards: swap(s.cards, cardId, dir) }));
export const toggleCardHidden = (c: SiteContent, sectionId: string, cardId: string): SiteContent =>
  mapSection(c, sectionId, (s) => ({
    ...s,
    cards: s.cards.map((x) => {
      if (x.id !== cardId) return x;
      if (x.hidden) {
        const { hidden: _h, ...rest } = x;
        return rest;
      }
      return { ...x, hidden: true };
    }),
  }));
