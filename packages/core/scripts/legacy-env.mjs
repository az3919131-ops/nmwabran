// يشغّل المنصة القديمة كاملة (reference/legacy.html) داخل jsdom ويعيد دالة eval في نطاقها العام.
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const LEGACY = path.resolve(here, "../../../reference/legacy.html");

export function bootLegacy() {
  const html = readFileSync(LEGACY, "utf8");
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("jsdomError", (e) => errors.push(String(e && e.message || e)));
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://legacy.test/",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
      w.scrollTo = () => {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.DecompressionStream = globalThis.DecompressionStream;
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    },
  });
  const ev = (code) => dom.window.eval(code);
  return { dom, ev, errors };
}
