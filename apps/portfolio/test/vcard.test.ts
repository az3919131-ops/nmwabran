import { describe, expect, it } from "vitest";
import { buildVCard, esc, fold } from "../src/lib/vcard";

describe("vCard", () => {
  it("يبني بطاقة 3.0 صحيحة بالعربية", () => {
    const v = buildVCard("ar");
    expect(v.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(v.trimEnd().endsWith("END:VCARD")).toBe(true);
    expect(v).toContain("FN:أحمد ممدوح زهران");
    expect(v).toContain("TEL;TYPE=CELL,VOICE,WORK:+966565324387");
    expect(v).toContain("EMAIL;TYPE=INTERNET,WORK:az3919131@gmail.com");
    expect(v).toContain("N:Zahran;Ahmed;Mamdouh;;");
    expect(v).not.toMatch(/[^\r]\n/); // كل الأسطر CRLF
  });

  it("يبني النسخة الإنجليزية ويضع التوقيع في الملاحظة", () => {
    const v = buildVCard("en");
    expect(v).toContain("FN:Ahmed Mamdouh Zahran");
    expect(v.replace(/\r\n /g, "")).toContain("NOTE:Project manager · Eng. Ahmed Zahran");
  });

  it("يهرّب الفواصل والفاصلة المنقوطة والأسطر", () => {
    expect(esc("a,b;c\nd\\")).toBe("a\\,b\;c\\nd\\\\");
  });

  it("يطوي الأسطر الطويلة بسطر يبدأ بمسافة ويمكن إعادة دمجه", () => {
    const long = "NOTE:" + "س".repeat(200);
    const folded = fold(long);
    expect(folded).toContain("\r\n ");
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});
