import { CARD_KINDS, ICON_KEYS, LINKEDIN_KINDS, STATUSES, type CardKind } from "../../data/content-types";
import { C } from "../../i18n/content-strings";
import type { Bi } from "../../i18n/lang";

// مواصفات حقول نماذج الإضافة والتعديل، يبني منها ItemForm الحقول والتحقق.
export type Field = { key: string; label: Bi; required?: boolean } & (
  | { kind: "bi"; multiline?: boolean; max?: number }
  | { kind: "text"; placeholder?: string; max?: number; date?: boolean }
  | { kind: "url"; allowRelative?: boolean }
  | { kind: "select"; options: Array<{ value: string; label: Bi }> }
  | { kind: "icon" }
  | { kind: "checkbox" }
  | { kind: "videos" }
);

const statusOptions = STATUSES.map((value) => ({ value, label: C.status[value] }));

export const SERVICE_FIELDS: Field[] = [
  { kind: "bi", key: "title", label: C.form.title, required: true, max: 120 },
  { kind: "bi", key: "description", label: C.form.description, multiline: true, max: 500 },
  { kind: "icon", key: "icon", label: C.form.icon },
  { kind: "text", key: "href", label: C.form.href, placeholder: "#platforms", max: 300 },
  { kind: "bi", key: "hrefLabel", label: C.form.hrefLabel, max: 60 },
];

export const PLATFORM_FIELDS: Field[] = [
  { kind: "bi", key: "name", label: C.form.name, required: true, max: 120 },
  { kind: "bi", key: "description", label: C.form.description, multiline: true, max: 500 },
  { kind: "bi", key: "category", label: C.form.category, max: 60 },
  { kind: "url", key: "url", label: C.form.url, required: true },
  { kind: "select", key: "status", label: C.form.status, options: statusOptions },
  { kind: "icon", key: "icon", label: C.form.icon },
  { kind: "url", key: "imageUrl", label: C.form.imageUrl },
  { kind: "text", key: "launchedAt", label: C.form.launchedAt, placeholder: "2026-03", max: 10, date: true },
  { kind: "checkbox", key: "featured", label: C.form.featured },
  { kind: "checkbox", key: "embed", label: C.form.embed },
];

export const CHANNEL_FIELDS: Field[] = [
  { kind: "bi", key: "name", label: C.form.name, required: true, max: 120 },
  { kind: "bi", key: "description", label: C.form.description, multiline: true, max: 500 },
  { kind: "url", key: "url", label: C.form.url, required: true },
  { kind: "text", key: "handle", label: C.form.handle, placeholder: "@name", max: 60 },
  { kind: "text", key: "subscribers", label: C.form.subscribers, max: 30 },
  { kind: "text", key: "views", label: C.form.views, max: 30 },
  { kind: "videos", key: "videos", label: C.form.videos },
];

export const LINKEDIN_FIELDS: Field[] = [
  { kind: "bi", key: "name", label: C.form.name, required: true, max: 120 },
  { kind: "select", key: "kind", label: C.form.kind, options: LINKEDIN_KINDS.map((value) => ({ value, label: C.linkedin.kinds[value] })) },
  { kind: "url", key: "url", label: C.form.url, required: true },
  { kind: "bi", key: "description", label: C.form.description, multiline: true, max: 300 },
];

export const PAGE_FIELDS: Field[] = [
  { kind: "bi", key: "title", label: C.form.title, required: true, max: 120 },
  { kind: "url", key: "url", label: C.form.url, required: true },
  { kind: "bi", key: "description", label: C.form.description, multiline: true, max: 300 },
];

export const SECTION_FIELDS: Field[] = [
  { kind: "bi", key: "title", label: C.form.title, required: true, max: 100 },
  { kind: "select", key: "kind", label: C.form.cardStyle, options: CARD_KINDS.map((value) => ({ value, label: C.custom.styles[value] })) },
  { kind: "checkbox", key: "visible", label: C.form.visible },
];

/** حقول بطاقة القسم المخصص بحسب الشكل المختار */
export function cardFields(kind: CardKind): Field[] {
  const title: Field = { kind: "bi", key: "title", label: C.form.title, required: true, max: 120 };
  switch (kind) {
    case "text":
      return [title, { kind: "bi", key: "body", label: C.form.body, multiline: true, required: true, max: 1500 }];
    case "image":
      return [title, { kind: "url", key: "imageUrl", label: C.form.imageUrl, required: true, allowRelative: true }, { kind: "bi", key: "body", label: C.form.description, max: 300 }, { kind: "url", key: "url", label: C.form.url, allowRelative: true }];
    case "file":
      return [title, { kind: "url", key: "url", label: C.form.url, required: true, allowRelative: true }, { kind: "text", key: "fileType", label: C.form.fileType, placeholder: "PDF", max: 12 }, { kind: "bi", key: "body", label: C.form.description, max: 300 }];
    default:
      return [title, { kind: "url", key: "url", label: C.form.url, required: true }, { kind: "bi", key: "body", label: C.form.description, multiline: true, max: 300 }];
  }
}

export { ICON_KEYS };
