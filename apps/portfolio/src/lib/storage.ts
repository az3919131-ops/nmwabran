// غلاف آمن للتخزين المحلي: قد يكون محجوبًا (وضع التصفح الخاص أو إعدادات المتصفح) فلا يجوز أن يكسر الصفحة.

type Kind = "local" | "session";

function area(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStore(key: string, kind: Kind = "local"): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string, kind: Kind = "local"): boolean {
  try {
    area(kind)?.setItem(key, value);
    return area(kind) !== null;
  } catch {
    return false;
  }
}

export function removeStore(key: string, kind: Kind = "local"): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    /* تجاهل */
  }
}

export function readJson<T>(key: string, fallback: T, kind: Kind = "local"): T {
  const raw = readStore(key, kind);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
