import { signature } from "../config";
import type { DailyMessage, Overview, ReplyRow } from "../lib/dashboardApi";
import { riyadhDate } from "../lib/stats";

// بيانات تجريبية بأرقام وهمية فقط — تظهر في وضع «جرّب بيانات تجريبية» ولا تُرسل لأي مكان.
const people: Array<[string, string, string]> = [
  ["خالد العتيبي", "966500000101", "السلام عليكم، أبحث عن مدير مشروع لعقد موحد في نجران"],
  ["Omar Hassan", "966500000102", "Hi, can we discuss a substation commissioning schedule?"],
  ["سلمان القحطاني", "966500000103", "ممكن عرض سعر لمتابعة مشروع تحويل شبكة؟"],
  ["Mona Ali", "966500000104", "Do you provide HV safety training for site engineers?"],
  ["فهد الدوسري", "966500000105", "مرحبا م. أحمد، أحتاج استشارة بخصوص اختبار الكابلات"],
  ["", "966500000106", "؟"],
  ["ياسر المطيري", "966500000107", "أرسل لي السيرة الذاتية من فضلك"],
];

export const demoMessageText = (name = "{name}") =>
  `السلام عليكم ${name}،\nشكرًا لتواصلك. وصلتني رسالتك وسأرد عليك في أقرب وقت خلال ساعات العمل.\nللأمور العاجلة اكتب كلمة «عاجل».\n\n${signature.plain}`;

export function demoOverview(now: Date = new Date()): Overview {
  const today = riyadhDate(now);
  const replies: ReplyRow[] = [];
  let id = 1;
  for (let d = 0; d < 12; d++) {
    const day = new Date(now.getTime() - d * 86_400_000);
    const count = [3, 2, 4, 1, 3, 5, 2, 0, 3, 4, 2, 1][d] ?? 0;
    for (let i = 0; i < count; i++) {
      const [name, phone, text] = people[(d * 3 + i) % people.length]!;
      const at = new Date(day.getTime() - i * 47 * 60_000);
      replies.push({
        id: String(id++),
        createdAt: at.toISOString(),
        phone,
        name,
        incomingText: text,
        replyDate: riyadhDate(at),
        replyText: demoMessageText(name || ""),
      });
    }
  }
  const message: DailyMessage = { message: demoMessageText(), enabled: true, updatedOn: today };
  return { message, replies };
}
