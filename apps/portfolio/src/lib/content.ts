import type { Bi } from "../i18n/lang";
import {
  CARD_KINDS,
  ICON_KEYS,
  LINKEDIN_KINDS,
  STATUSES,
  type CardKind,
  type CustomCard,
  type CustomSection,
  type Hideable,
  type IconKey,
  type LinkedinKind,
  type LinkedinPage,
  type ListKey,
  type PageLink,
  type Platform,
  type Service,
  type SiteContent,
  type Status,
  type YouTubeChannel,
  type YouTubeVideo,
} from "../data/content-types";
import seed from "../data/site-content.json";
import { readJson, removeStore, writeStore } from "./storage";

// ───────────── أدوات التنظيف والتحقق (المحتوى قد يأتي من ملف عدّله صاحب الموقع يدويًا) ─────────────

export function newId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** يقبل http(s) فقط (يمنع javascript: وغيره). allowRelative تسمح بمسار نسبي من نفس الموقع (للملفات). */
export function safeUrl(v: unknown, allowRelative = false): string {
  const s = str(v, 2048);
  if (!s) return "";
  if (allowRelative && /^(\.{0,2}\/)(?!\/)[^\s]*$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function bi(v: unknown, max = 400): Bi {
  if (typeof v === "string") {
    const s = str(v, max);
    return { ar: s, en: s };
  }
  const o = (v ?? {}) as Record<string, unknown>;
  return { ar: str(o.ar, max), en: str(o.en, max) };
}
const hasText = (b: Bi) => Boolean(b.ar || b.en);
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const date = (v: unknown): string | undefined => {
  const s = str(v, 10);
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s) ? s : undefined;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** يضمن معرّفات فريدة وصالحة */
function uniqueIds<T extends { id: string }>(items: T[], prefix: string): T[] {
  const seen = new Set<string>();
  return items.map((it) => {
    let id = /^[\w-]{1,64}$/.test(it.id) ? it.id : newId(prefix);
    while (seen.has(id)) id = newId(prefix);
    seen.add(id);
    return { ...it, id };
  });
}

const base = (r: Record<string, unknown>): Hideable => ({ id: str(r.id, 64), ...(r.hidden === true ? { hidden: true } : {}) });

const service = (v: unknown): Service | null => {
  const r = rec(v);
  const title = bi(r.title, 120);
  if (!hasText(title)) return null;
  const href = str(r.href, 300);
  const okHref = /^#[\w-]+$/.test(href) ? href : safeUrl(href);
  return {
    ...base(r),
    icon: oneOf<IconKey>(r.icon, ICON_KEYS, "briefcase"),
    title,
    description: bi(r.description, 500),
    ...(okHref ? { href: okHref, hrefLabel: bi(r.hrefLabel, 60) } : {}),
  };
};

const platform = (v: unknown): Platform | null => {
  const r = rec(v);
  const name = bi(r.name, 120);
  const url = safeUrl(r.url);
  if (!hasText(name) || !url) return null;
  const imageUrl = safeUrl(r.imageUrl);
  const launchedAt = date(r.launchedAt);
  return {
    ...base(r),
    name,
    description: bi(r.description, 500),
    category: bi(r.category, 60),
    url,
    status: oneOf<Status>(r.status, STATUSES, "working"),
    icon: oneOf<IconKey>(r.icon, ICON_KEYS, "globe"),
    ...(imageUrl ? { imageUrl } : {}),
    ...(launchedAt ? { launchedAt } : {}),
    ...(r.featured === true ? { featured: true } : {}),
    ...(r.embed === true ? { embed: true } : {}),
  };
};

const video = (v: unknown): YouTubeVideo | null => {
  const r = rec(v);
  const url = safeUrl(r.url);
  const title = str(r.title, 150);
  return url && title ? { id: str(r.id, 64), title, url } : null;
};

const channel = (v: unknown): YouTubeChannel | null => {
  const r = rec(v);
  const name = bi(r.name, 120);
  const url = safeUrl(r.url);
  if (!hasText(name) || !url) return null;
  const handle = str(r.handle, 60);
  const subscribers = str(r.subscribers, 30);
  const views = str(r.views, 30);
  return {
    ...base(r),
    name,
    description: bi(r.description, 500),
    url,
    ...(handle ? { handle } : {}),
    ...(subscribers ? { subscribers } : {}),
    ...(views ? { views } : {}),
    videos: uniqueIds(arr(r.videos).map(video).filter((x): x is YouTubeVideo => !!x), "vid"),
  };
};

const linkedin = (v: unknown): LinkedinPage | null => {
  const r = rec(v);
  const name = bi(r.name, 120);
  const url = safeUrl(r.url);
  if (!hasText(name) || !url) return null;
  return { ...base(r), name, kind: oneOf<LinkedinKind>(r.kind, LINKEDIN_KINDS, "personal"), url, description: bi(r.description, 300) };
};

const pageLink = (v: unknown): PageLink | null => {
  const r = rec(v);
  const title = bi(r.title, 120);
  const url = safeUrl(r.url);
  if (!hasText(title) || !url) return null;
  return { ...base(r), title, description: bi(r.description, 300), url };
};

const card = (v: unknown): CustomCard | null => {
  const r = rec(v);
  const title = bi(r.title, 120);
  if (!hasText(title)) return null;
  const body = bi(r.body, 1500);
  const url = safeUrl(r.url, true);
  const imageUrl = safeUrl(r.imageUrl, true);
  const fileType = str(r.fileType, 12);
  return {
    ...base(r),
    title,
    ...(hasText(body) ? { body } : {}),
    ...(url ? { url } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(fileType ? { fileType } : {}),
  };
};

const section = (v: unknown): CustomSection | null => {
  const r = rec(v);
  const title = bi(r.title, 100);
  if (!hasText(title)) return null;
  return {
    id: str(r.id, 64),
    title,
    kind: oneOf<CardKind>(r.kind, CARD_KINDS, "link"),
    visible: r.visible !== false,
    cards: uniqueIds(arr(r.cards).map(card).filter((x): x is CustomCard => !!x), "card"),
  };
};

export const SECTION_KEYS: ListKey[] = ["services", "platforms", "security", "youtube", "linkedin", "pages"];

/** يحوّل أي JSON إلى محتوى صالح: يحذف العناصر المعطوبة ويمنع الروابط غير الآمنة. غير المفهوم كله يرجع إلى fallback. */
export function parseContent(raw: unknown, fallback: SiteContent): SiteContent {
  const r = rec(raw);
  if (r.version !== 1) return fallback;
  const vis = rec(r.visibility);
  const visibility = Object.fromEntries(SECTION_KEYS.map((k) => [k, vis[k] !== false])) as SiteContent["visibility"];
  return {
    version: 1,
    visibility,
    services: uniqueIds(arr(r.services).map(service).filter((x): x is Service => !!x), "svc"),
    platforms: uniqueIds(arr(r.platforms).map(platform).filter((x): x is Platform => !!x), "pl"),
    security: uniqueIds(arr(r.security).map(platform).filter((x): x is Platform => !!x), "sec"),
    youtube: uniqueIds(arr(r.youtube).map(channel).filter((x): x is YouTubeChannel => !!x), "yt"),
    linkedin: uniqueIds(arr(r.linkedin).map(linkedin).filter((x): x is LinkedinPage => !!x), "li"),
    pages: uniqueIds(arr(r.pages).map(pageLink).filter((x): x is PageLink => !!x), "pg"),
    custom: uniqueIds(arr(r.custom).map(section).filter((x): x is CustomSection => !!x), "sec"),
  };
}

export const emptyContent = (): SiteContent => ({
  version: 1,
  visibility: { services: true, platforms: true, security: true, youtube: true, linkedin: true, pages: true },
  services: [],
  platforms: [],
  security: [],
  youtube: [],
  linkedin: [],
  pages: [],
  custom: [],
});

/** المحتوى المنشور مع التطبيع: ما في data/site-content.json وقت البناء */
export const publishedContent: SiteContent = parseContent(seed, emptyContent());

export const serializeContent = (c: SiteContent): string => JSON.stringify(c, null, 2) + "\n";

/** بصمة قصيرة تربط المسودة بالنسخة المنشورة التي بُنيت عليها */
export function contentHash(c: SiteContent): string {
  const s = JSON.stringify(c);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ───────────── المسودة المحلية ─────────────

const DRAFT_KEY = "nm.content.draft";

/** المسودة تُستعمل فقط إن كانت مبنية على نسخة الملف المنشورة الحالية؛ بعد نشر جديد تُهمل تلقائيًا */
export function loadDraft(baseHash: string, fallback: SiteContent): SiteContent | null {
  const raw = readJson<{ base?: string; content?: unknown } | null>(DRAFT_KEY, null);
  if (!raw || raw.base !== baseHash) return null;
  return parseContent(raw.content, fallback);
}
export const saveDraft = (baseHash: string, content: SiteContent): boolean => writeStore(DRAFT_KEY, JSON.stringify({ base: baseHash, content }));
export const clearDraft = (): void => removeStore(DRAFT_KEY);

// ───────────── عرض ─────────────

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** معرّف فيديو يوتيوب من أشهر صيغ الروابط، أو null */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\.|^m\./, "");
    let id = "";
    if (h === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? "";
    else if (h === "youtube.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
      else id = /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? "";
    }
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** اختيار نص اللغة الحالية مع الرجوع للغة الأخرى إن كان فارغًا */
export const pick = (b: Bi | undefined, lang: "ar" | "en"): string => (b ? b[lang] || b[lang === "ar" ? "en" : "ar"] : "");
