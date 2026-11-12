import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SiteContent } from "../data/content-types";
import { clearDraft, contentHash, loadDraft, publishedContent, saveDraft, serializeContent } from "./content";

type Ctx = {
  /** ما يُعرض الآن: المسودة إن وُجدت وإلا المنشور */
  content: SiteContent;
  published: SiteContent;
  /** وضع التحرير (مسار #/edit) */
  editing: boolean;
  dirty: boolean;
  update: (fn: (c: SiteContent) => SiteContent) => void;
  discard: () => void;
  exportJson: () => string;
};

const Context = createContext<Ctx | null>(null);

export function ContentProvider({ editing, published = publishedContent, children }: { editing: boolean; published?: SiteContent; children: ReactNode }) {
  const baseHash = useMemo(() => contentHash(published), [published]);
  const [draft, setDraft] = useState<SiteContent | null>(() => loadDraft(baseHash, published));

  // حفظ المسودة؛ وإن طابقت المنشور تُلغى
  useEffect(() => {
    if (draft === null) return clearDraft();
    if (contentHash(draft) === baseHash) {
      clearDraft();
      setDraft(null);
      return;
    }
    saveDraft(baseHash, draft);
  }, [draft, baseHash]);

  const update = useCallback((fn: (c: SiteContent) => SiteContent) => setDraft((d) => fn(d ?? published)), [published]);
  const discard = useCallback(() => setDraft(null), []);
  const content = draft ?? published;
  const exportJson = useCallback(() => serializeContent(content), [content]);

  const value = useMemo<Ctx>(
    () => ({ content, published, editing, dirty: draft !== null, update, discard, exportJson }),
    [content, published, editing, draft, update, discard, exportJson],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useContent(): Ctx {
  const v = useContext(Context);
  if (!v) throw new Error("useContent must be used inside <ContentProvider>");
  return v;
}
