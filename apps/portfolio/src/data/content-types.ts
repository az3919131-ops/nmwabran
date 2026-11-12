import type { Bi } from "../i18n/lang";

// نموذج المحتوى القابل للتعديل (منصات، قنوات، صفحات، أقسام مخصصة…).
// المصدر المنشور: data/site-content.json؛ وتعديلات صاحب الموقع تُحفظ مسودة في متصفحه حتى يرفعها إلى الملف.

export type Status = "working" | "beta" | "stopped";
export const STATUSES: Status[] = ["working", "beta", "stopped"];

export const ICON_KEYS = [
  "graduation",
  "building",
  "shield",
  "globe",
  "layout",
  "wrench",
  "bolt",
  "gantt",
  "mentor",
  "thermo",
  "bot",
  "briefcase",
  "play",
  "link",
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

export type Hideable = { id: string; hidden?: boolean };

export type Service = Hideable & {
  icon: IconKey;
  title: Bi;
  description: Bi;
  /** رابط ثانوي اختياري: مرساة داخلية (#platforms) أو رابط خارجي */
  href?: string;
  hrefLabel?: Bi;
};

export type Platform = Hideable & {
  name: Bi;
  description: Bi;
  category: Bi;
  url: string;
  status: Status;
  icon: IconKey;
  imageUrl?: string;
  /** 2026 أو 2026-03 أو 2026-03-15 */
  launchedAt?: string;
  featured?: boolean;
  /** المعاينة المضمنة تُعرض فقط إن حدّد صاحب الموقع أن الموقع يسمح بالعرض داخل إطار */
  embed?: boolean;
};

export type YouTubeVideo = { id: string; title: string; url: string };
export type YouTubeChannel = Hideable & {
  name: Bi;
  description: Bi;
  url: string;
  handle?: string;
  /** تُعرض كما أُدخلت يدويًا ولا تُعرض إن تُركت فارغة */
  subscribers?: string;
  views?: string;
  videos: YouTubeVideo[];
};

export type LinkedinKind = "personal" | "company" | "project";
export const LINKEDIN_KINDS: LinkedinKind[] = ["personal", "company", "project"];
export type LinkedinPage = Hideable & { name: Bi; kind: LinkedinKind; url: string; description: Bi };

export type PageLink = Hideable & { title: Bi; description: Bi; url: string };

export type CardKind = "link" | "text" | "image" | "file";
export const CARD_KINDS: CardKind[] = ["link", "text", "image", "file"];
export type CustomCard = Hideable & {
  title: Bi;
  body?: Bi;
  url?: string;
  imageUrl?: string;
  fileType?: string;
};
export type CustomSection = { id: string; title: Bi; kind: CardKind; visible: boolean; cards: CustomCard[] };

export type ListKey = "services" | "platforms" | "security" | "youtube" | "linkedin" | "pages";
export type SectionKey = ListKey;

export type SiteContent = {
  version: 1;
  visibility: Record<SectionKey, boolean>;
  services: Service[];
  platforms: Platform[];
  security: Platform[];
  youtube: YouTubeChannel[];
  linkedin: LinkedinPage[];
  pages: PageLink[];
  custom: CustomSection[];
};

export type ItemOf<K extends ListKey> = SiteContent[K][number];
