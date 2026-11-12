import { config } from "../config";
import type { Lang } from "../i18n/lang";

/** رابط واتساب مباشر برسالة جاهزة */
export function waLink(text: string, number: string = config.whatsappNumber): string {
  const q = text.trim() ? `&text=${encodeURIComponent(text.trim())}` : "";
  return `https://api.whatsapp.com/send?phone=${number.replace(/\D/g, "")}${q}`;
}

/** رابط محادثة مع رقم عميل (للوحة التحكم) */
export function waChatLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/** يصوغ رسالة النموذج: تحية + اسم المرسل + نص الرسالة */
export function buildContactMessage(input: { name: string; message: string; lang: Lang }): string {
  const name = input.name.trim();
  const body = input.message.trim();
  if (input.lang === "ar") {
    return `السلام عليكم م. أحمد، معك ${name}.\n\n${body}\n\n— أرسلتها من موقعك الشخصي`;
  }
  return `Hello Eng. Ahmed, this is ${name}.\n\n${body}\n\n— sent from your website`;
}
