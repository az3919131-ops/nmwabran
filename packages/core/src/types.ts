export type Lang = "ar" | "en";

export interface Material { c: string; ar: string; en: string; u: string; p: number; k: "main" | "detail"; g: string; added?: boolean }
export interface Work { c: string; ar: string; en: string; u: string; p: number; g: string; added?: boolean }
export interface Catalog { materials: Material[]; works: Work[] }

export interface Factors {
  drumLen: number; cuPerRMU: number; cuPerTR: number; rodsPerRMU: number; rodsPerTR: number; rodsPerPillar: number;
  cConnPerRMU: number; luPerRMU: number; clampPerTR: number; connPerTR: number; elbowPerTR: number; elbowPhases: number;
  bollardPerRMU: number; wastePct: number; indirectPct: number; trenchWidthLV: number; trenchWidthMV: number; vlfPerSection: number;
  [k: string]: number;
}
export interface SheetFieldGroup { g: string; gEn: string; f: [string, string, string][] }
export interface AuthorityStep { max: number; ar: string; en: string }

export type Sheet = { name: string; [k: string]: number | string };
export type Totals = Record<string, number>;
export interface BoqLine { plan: number; exec: number }
export interface MatLine { iss: number; req: number }
export interface Derived {
  works: Record<string, number>; mats: Record<string, number>; t: Totals;
  cost: { mat: number; inst: number; ind: number; total: number }; at: string;
}
export interface RmuRow {
  no: number; feeder: string; rmu: string; type: string; tr: string; relay: string; model: string;
  set: boolean; ratio: string; ohm: string; gps: string; gpsSrc?: string;
}
export interface GeoPoint { id: string; lat: number; lon: number; src: string; type: string }
export type RepKind = "ok" | "new" | "ai" | "warn" | "skip";
export type Rep = [RepKind, string];
export interface Identity {
  wo?: string; req?: string; name?: string; site?: string; admin?: string; sector?: string; contractor?: string;
  woWeak?: boolean; woReq?: boolean; woFromName?: boolean; nameWeak?: boolean;
}
export type WoState = "match" | "mismatch" | "related" | "weak" | "adopt" | "none";
export interface FileRec {
  id: string; name: string; size: number; type: string; ext: string; kind: string;
  imported: boolean; rows: number; at: string; rep: Rep[]; url?: string; blocked?: boolean;
  ident?: Identity; woState?: WoState; geoN?: number; hasOriginal?: boolean; storageKey?: string;
}
export interface InvoiceHead { no: string; date: string; period: string; retentionPct: number; deduct: number; prev: number; vatPct: number; useVat: boolean }

export interface Project {
  id: string; name: string; wo: string; admin: string; sector: string;
  /** فهرس المقاول داخل قائمة المقاولين (كما في المنصة الحالية) */
  contractor: number;
  site: string; approvedDate: string;
  estCost: { mat: number; inst: number; ind: number };
  sheets: Sheet[]; factors: Factors; files: FileRec[];
  derived: Derived | null;
  boq: Record<string, BoqLine>; mat: Record<string, MatLine>;
  rmus: RmuRow[]; accept: Record<string, unknown>; notes: string;
  geo?: GeoPoint[]; inv?: InvoiceHead; prevTotal?: number;
}

export interface Ctx { lang: Lang; T: (ar: string, en: string) => string; cat: Catalog }
