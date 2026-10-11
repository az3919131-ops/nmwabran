// كل الإعدادات العامة في مكان واحد. القيم تأتي من متغيرات VITE_* (انظر .env.example) ولها افتراضيات للتجربة.
// تنبيه: كل ما هنا يُدمج في ملفات الواجهة العامة — لا أسرار هنا.

const env = import.meta.env as Record<string, string | undefined>;

const trimSlash = (s: string) => s.trim().replace(/\/+$/, "");

/** خادم n8n الخاص بصاحب الموقع؛ يُستبدل بـ VITE_N8N_BASE_URL (وقيمة فارغة صريحة تعطّل الافتراضي) */
const DEFAULT_N8N_BASE_URL = "https://vmi3330209.contaboserver.net";

export const config = {
  /** رقم واتساب بصيغة دولية بلا + ولا مسافات */
  whatsappNumber: (env.VITE_WHATSAPP_NUMBER || "966565324387").replace(/\D/g, ""),
  email: "az3919131@gmail.com",
  linkedin: "https://www.linkedin.com/in/ahmed-zahran-8b7730340",
  /** عنوان خادم n8n بلا شرطة أخيرة */
  n8nBaseUrl: trimSlash(env.VITE_N8N_BASE_URL ?? DEFAULT_N8N_BASE_URL),
  /** معرّف webhook / نموذج مراجعة الصفحة والتعليقات */
  n8nWebhookId: (env.VITE_N8N_WEBHOOK_ID || "0818531a-3892-49f6-af78-cde8d538b205").trim(),
  /** مسار webhook لوحة التحكم داخل n8n */
  n8nDashboardPath: (env.VITE_N8N_DASHBOARD_PATH || "ahmed-dashboard").replace(/^\/+|\/+$/g, ""),
  siteUrl: trimSlash(env.VITE_SITE_URL || ""),
} as const;

/** التوقيع المطلوب أسفل كل صفحة وكل عمل يُنشر من التطبيق (بنفس صيغة packages/core/src/signature.ts) */
export const signature = {
  en: "Project manager · Eng. Ahmed Zahran",
  ar: "مدير المشاريع · م. أحمد زهران",
  /** النص الذي يُلحق برسائل واتساب الصادرة من لوحة التحكم */
  plain: "Project manager · Eng. Ahmed Zahran",
} as const;

/** +966565324387 → +966 56 532 4387 (تنسيق سعودي؛ غيره يُعرض كما هو مع +) */
export function formatPhone(digits: string): string {
  const m = /^966(\d{2})(\d{3})(\d{4})$/.exec(digits);
  return m ? `+966 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}
