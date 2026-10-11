import { describe, expect, it } from "vitest";
import * as profile from "../src/data/profile";
import { S } from "../src/i18n/strings";
import { D } from "../src/dashboard/strings";

// يمر على كل كائن { ar, en } ويتأكد أن اللغتين موجودتان وغير فارغتين وبنفس الشكل
function leaves(node: unknown, path: string, out: Array<[string, { ar: unknown; en: unknown }]>) {
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if ("ar" in o || "en" in o) {
    out.push([path, o as { ar: unknown; en: unknown }]);
    return;
  }
  for (const [k, v] of Object.entries(o)) leaves(v, `${path}.${k}`, out);
}

const nonEmpty = (v: unknown) => (Array.isArray(v) ? v.length > 0 && v.every((x) => typeof x === "string" && x.trim()) : typeof v === "string" && v.trim().length > 0);

describe("ثنائية اللغة", () => {
  const all: Array<[string, { ar: unknown; en: unknown }]> = [];
  leaves(S, "S", all);
  leaves(D, "D", all);
  leaves(profile, "profile", all);

  it("جمع عددًا معقولًا من النصوص", () => expect(all.length).toBeGreaterThan(150));

  it.each(all)("%s فيه عربي وإنجليزي", (_path, v) => {
    expect(nonEmpty(v.ar)).toBe(true);
    expect(nonEmpty(v.en)).toBe(true);
    if (Array.isArray(v.ar) && Array.isArray(v.en)) expect(v.ar.length).toBe(v.en.length);
  });

  it("المعرّفات فريدة في الأدوار والمشاريع والشهادات", () => {
    for (const list of [profile.roles, profile.projects, profile.credentials]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("شهادة PMP تظهر بحالتها الفعلية (قيد الإعداد) حتى تُكتسب", () => {
    expect(profile.credentials.find((c) => c.id === "pmp")?.status).toBe("in-progress");
  });
});
