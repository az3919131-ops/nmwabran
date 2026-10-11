import type { Bi } from "./lang";

// نصوص الواجهة (غير المحتوى الشخصي). كل ورقة { ar, en } ويفحص الاختبار أن اللغتين موجودتان.
export const S = {
  brand: { ar: "أحمد زهران", en: "Ahmed Zahran" } as Bi,
  nav: {
    about: { ar: "نبذة", en: "About" } as Bi,
    experience: { ar: "الخبرات", en: "Experience" } as Bi,
    projects: { ar: "المشاريع", en: "Projects" } as Bi,
    certifications: { ar: "الشهادات", en: "Certifications" } as Bi,
    contact: { ar: "تواصل", en: "Contact" } as Bi,
    menu: { ar: "القائمة", en: "Menu" } as Bi,
    close: { ar: "إغلاق", en: "Close" } as Bi,
    skip: { ar: "تخطّي إلى المحتوى", en: "Skip to content" } as Bi,
  },
  actions: {
    whatsapp: { ar: "تواصل عبر واتساب", en: "Chat on WhatsApp" } as Bi,
    saveContact: { ar: "حفظ جهة الاتصال", en: "Save contact" } as Bi,
    saved: { ar: "تم تنزيل بطاقة الاتصال", en: "Contact card downloaded" } as Bi,
  },
  hero: {
    greeting: { ar: "السلام عليكم، أود التواصل معك بخصوص مشروع.", en: "Hello Eng. Ahmed, I would like to discuss a project." } as Bi,
    portrait: { ar: "صورة أحمد زهران", en: "Portrait of Ahmed Zahran" } as Bi,
    metrics: { ar: "أرقام العمل", en: "Track record" } as Bi,
  },
  about: {
    title: { ar: "نبذة وقدرات أساسية", en: "About & core capabilities" } as Bi,
    lead: {
      ar: "مهندس كهرباء يدير المشاريع: يفهم تفاصيل الكابل والمحول في الموقع، ويقرأ العقد والميزانية في المكتب.",
      en: "An electrical engineer who manages projects: fluent in the cable and the transformer on site, and in the contract and the budget in the office.",
    } as Bi,
    tools: { ar: "الأدوات والبرامج", en: "Tools & software" } as Bi,
    languages: { ar: "اللغات", en: "Languages" } as Bi,
  },
  experience: {
    title: { ar: "مسار الخبرة", en: "Career timeline" } as Bi,
    lead: {
      ar: "من صيانة الكابلات والمحولات في الموقع إلى قيادة مشاريع العقود الموحدة للشركة السعودية للكهرباء.",
      en: "From cable and transformer maintenance in the field to leading SEC unified-contract projects.",
    } as Bi,
    now: { ar: "الحالي", en: "Current" } as Bi,
    expand: { ar: "عرض التفاصيل", en: "Show details" } as Bi,
    collapse: { ar: "إخفاء التفاصيل", en: "Hide details" } as Bi,
  },
  projects: {
    title: { ar: "آخر المشاريع المنجزة", en: "Recent delivered projects" } as Bi,
    lead: {
      ar: "مشاريع شبكات ومحطات في منطقة نجران ضمن عقود الشركة السعودية للكهرباء.",
      en: "Network and substation projects in the Najran region under SEC contracts.",
    } as Bi,
  },
  certs: {
    title: { ar: "التعليم والشهادات", en: "Education & certifications" } as Bi,
    lead: {
      ar: "ما أُنجز وما هو قيد الإنجاز، كلٌّ بحالته الفعلية.",
      en: "What is earned and what is in progress, each with its actual status.",
    } as Bi,
    earned: { ar: "مكتسبة", en: "Earned" } as Bi,
    inProgress: { ar: "قيد الإعداد", en: "In progress" } as Bi,
    training: { ar: "دورات وتدريب فني", en: "Technical training" } as Bi,
    kind: {
      education: { ar: "مؤهل علمي", en: "Degree" } as Bi,
      certificate: { ar: "شهادة", en: "Certificate" } as Bi,
      course: { ar: "دورة", en: "Course" } as Bi,
      experience: { ar: "خبرة تدريب", en: "Teaching" } as Bi,
    },
  },
  contact: {
    title: { ar: "تواصل معي", en: "Get in touch" } as Bi,
    lead: {
      ar: "رسالة مباشرة على واتساب، أو أرسل صفحتك لمحلل n8n الذكي ليراجعها ويعلّق عليها.",
      en: "Message me directly on WhatsApp, or send your page to the n8n AI reviewer for comments.",
    } as Bi,
    tabWhatsapp: { ar: "رسالة واتساب", en: "WhatsApp message" } as Bi,
    tabN8n: { ar: "مراجعة ذكية عبر n8n", en: "n8n AI review" } as Bi,
    phone: { ar: "واتساب / هاتف", en: "WhatsApp / phone" } as Bi,
    email: { ar: "البريد الإلكتروني", en: "Email" } as Bi,
    linkedin: { ar: "لينكدإن", en: "LinkedIn" } as Bi,
    location: { ar: "الموقع", en: "Location" } as Bi,
    name: { ar: "الاسم", en: "Name" } as Bi,
    fullName: { ar: "الاسم الكامل", en: "Full name" } as Bi,
    namePh: { ar: "اسمك الكريم", en: "Your name" } as Bi,
    message: { ar: "الرسالة", en: "Message" } as Bi,
    messagePh: { ar: "اكتب رسالتك أو تفاصيل المشروع…", en: "Write your message or project details…" } as Bi,
    sendWhatsapp: { ar: "فتح واتساب وإرسال الرسالة", en: "Open WhatsApp & send" } as Bi,
    required: { ar: "هذا الحقل مطلوب", en: "This field is required" } as Bi,
    waHint: {
      ar: "سيفتح واتساب برسالة جاهزة، وتضغط إرسال من تطبيقك.",
      en: "WhatsApp opens with your message ready; press send in the app.",
    } as Bi,
    waIntro: { ar: "السلام عليكم م. أحمد، معك", en: "Hello Eng. Ahmed, this is" } as Bi,
  },
  n8n: {
    lead: {
      ar: "أدخل رابط صفحتك وتعليقك، وسيحلّلها وكيل الذكاء الاصطناعي في n8n ويردّ عليك.",
      en: "Enter your page URL and notes; the AI agent in n8n will analyse it and respond.",
    } as Bi,
    url: { ar: "رابط الصفحة (Landing Page URL)", en: "Landing page URL" } as Bi,
    useCurrent: { ar: "استخدم الرابط الحالي", en: "Use current URL" } as Bi,
    comments: { ar: "التعليقات والملاحظات", en: "Comments / feedback" } as Bi,
    commentsPh: {
      ar: "ما الذي تريد من المحلل أن يركز عليه؟",
      en: "What should the analyser focus on?",
    } as Bi,
    send: { ar: "إرسال إلى محلل n8n الذكي", en: "Send to n8n AI analyser" } as Bi,
    sending: { ar: "جارٍ الإرسال…", en: "Sending…" } as Bi,
    openForm: { ar: "فتح نموذج n8n المباشر", en: "Open the n8n form" } as Bi,
    settings: { ar: "إعدادات n8n", en: "n8n settings" } as Bi,
    success: { ar: "وصل طلبك إلى n8n وسيصلك الرد قريبًا.", en: "Your request reached n8n; a reply will follow." } as Bi,
    successUnconfirmed: {
      ar: "أُرسل الطلب إلى n8n، لكن المتصفح لا يسمح بتأكيد الاستلام (قيود CORS). تحقق من سجل التنفيذ في n8n.",
      en: "Sent to n8n, but the browser can't confirm receipt (CORS). Check the execution log in n8n.",
    } as Bi,
    errorGeneric: { ar: "تعذّر الإرسال", en: "Could not send" } as Bi,
    errorStatus: { ar: "رفض n8n الطلب (الحالة {status})", en: "n8n rejected the request (status {status})" } as Bi,
    notConfigured: {
      ar: "عنوان خادم n8n غير مضبوط. افتح الإعدادات وأدخله.",
      en: "The n8n server address isn't set. Open settings and enter it.",
    } as Bi,
    badUrl: { ar: "أدخل رابطًا صحيحًا يبدأ بـ https://", en: "Enter a valid URL starting with https://" } as Bi,
    dismiss: { ar: "إخفاء", en: "Dismiss" } as Bi,
  },
  settings: {
    title: { ar: "إعدادات ربط n8n", en: "n8n connection settings" } as Bi,
    intro: {
      ar: "تُحفظ هذه القيم في متصفحك فقط (localStorage) ولا تُرسل لأحد.",
      en: "These values are stored only in this browser (localStorage) and shared with no one.",
    } as Bi,
    base: { ar: "عنوان خادم n8n", en: "n8n server URL" } as Bi,
    webhook: { ar: "رابط Webhook (POST)", en: "Webhook URL (POST)" } as Bi,
    form: { ar: "رابط النموذج المباشر", en: "Direct form URL" } as Bi,
    leaveEmpty: { ar: "اتركه فارغًا لاستخدام القيمة المشتقة", en: "Leave empty to use the derived value" } as Bi,
    save: { ar: "حفظ الإعدادات", en: "Save settings" } as Bi,
    reset: { ar: "استعادة الافتراضي", en: "Reset to defaults" } as Bi,
    saved: { ar: "تم حفظ الإعدادات", en: "Settings saved" } as Bi,
    payload: { ar: "شكل البيانات المرسلة", en: "Payload shape" } as Bi,
    cors: {
      ar: "لإظهار نتيجة الإرسال فعّل Allowed Origins (CORS) في عقدة Webhook داخل n8n.",
      en: "To see the delivery result, enable Allowed Origins (CORS) on the n8n Webhook node.",
    } as Bi,
  },
  footer: {
    rights: { ar: "جميع الحقوق محفوظة", en: "All rights reserved" } as Bi,
    dashboard: { ar: "لوحة التحكم", en: "Dashboard" } as Bi,
    backToSite: { ar: "العودة إلى الموقع", en: "Back to site" } as Bi,
    langSwitch: { ar: "تبديل اللغة", en: "Switch language" } as Bi,
  },
  notFound: {
    title: { ar: "الصفحة غير موجودة", en: "Page not found" } as Bi,
    text: { ar: "الرابط غير صحيح أو نُقلت الصفحة.", en: "The link is wrong or the page has moved." } as Bi,
  },
};
