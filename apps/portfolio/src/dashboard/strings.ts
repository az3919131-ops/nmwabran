import type { Bi } from "../i18n/lang";

// نصوص لوحة التحكم. الأفعال ثابتة عبر الواجهة: «احفظ» تنتج «تم الحفظ»، «اتصل» تنتج «تم الاتصال».
export const D = {
  title: { ar: "لوحة التحكم", en: "Dashboard" } as Bi,
  subtitle: { ar: "الرد الآلي على واتساب عبر n8n", en: "WhatsApp auto-reply through n8n" } as Bi,
  back: { ar: "العودة إلى الموقع", en: "Back to site" } as Bi,
  modeLive: { ar: "متصل بـ n8n", en: "Connected to n8n" } as Bi,
  modeDemo: { ar: "بيانات تجريبية", en: "Demo data" } as Bi,
  refresh: { ar: "تحديث", en: "Refresh" } as Bi,
  refreshing: { ar: "جارٍ التحديث…", en: "Refreshing…" } as Bi,
  disconnect: { ar: "قطع الاتصال", en: "Disconnect" } as Bi,
  lastSync: { ar: "آخر تحديث", en: "Last updated" } as Bi,

  tabs: {
    overview: { ar: "نظرة عامة", en: "Overview" } as Bi,
    reply: { ar: "رسالة الرد", en: "Reply message" } as Bi,
    log: { ar: "سجل الردود", en: "Reply log" } as Bi,
    connection: { ar: "الربط مع n8n", en: "n8n connection" } as Bi,
  },

  gate: {
    title: { ar: "اتصل بـ n8n لعرض لوحتك", en: "Connect to n8n to see your dashboard" } as Bi,
    lead: {
      ar: "أدخل رابط واجهة لوحة التحكم ومفتاحك السري من n8n. المفتاح لا يُحفظ في الكود ولا يُرسل لغير خادمك.",
      en: "Enter your dashboard API URL and secret key from n8n. The key is never stored in code and goes only to your server.",
    } as Bi,
    url: { ar: "رابط واجهة لوحة التحكم (Webhook)", en: "Dashboard API URL (webhook)" } as Bi,
    key: { ar: "المفتاح السري", en: "Secret key" } as Bi,
    showKey: { ar: "إظهار المفتاح", en: "Show key" } as Bi,
    hideKey: { ar: "إخفاء المفتاح", en: "Hide key" } as Bi,
    remember: { ar: "تذكّرني على هذا الجهاز", en: "Remember me on this device" } as Bi,
    connect: { ar: "اتصل", en: "Connect" } as Bi,
    connecting: { ar: "جارٍ الاتصال…", en: "Connecting…" } as Bi,
    demo: { ar: "جرّب بيانات تجريبية", en: "Try demo data" } as Bi,
    demoHint: { ar: "بيانات وهمية لمعاينة الشكل، ولا تُرسل لأي مكان.", en: "Fake data to preview the layout; nothing is sent anywhere." } as Bi,
    setup: { ar: "خطوات الإعداد", en: "Setup steps" } as Bi,
  },

  err: {
    "not-configured": { ar: "أدخل رابط الواجهة أولًا.", en: "Enter the API URL first." } as Bi,
    unauthorized: { ar: "المفتاح غير صحيح. تحقق منه في جدول dashboard_config داخل n8n.", en: "The key is wrong. Check it in the dashboard_config table inside n8n." } as Bi,
    network: {
      ar: "تعذّر الوصول إلى n8n. تأكد من الرابط ومن تفعيل الـ workflow وإعداد CORS (Allowed Origins).",
      en: "Couldn't reach n8n. Check the URL, that the workflow is published, and CORS (Allowed Origins).",
    } as Bi,
    server: { ar: "أرجع n8n خطأ. افتح سجل التنفيذ في n8n لمعرفة السبب.", en: "n8n returned an error. Open the execution log in n8n for details." } as Bi,
    "bad-response": { ar: "ردّ n8n بصيغة غير متوقعة. تأكد أن الرابط يخص workflow لوحة التحكم.", en: "n8n replied in an unexpected format. Make sure the URL belongs to the dashboard workflow." } as Bi,
  },

  kpi: {
    today: { ar: "ردود اليوم", en: "Replies today" } as Bi,
    yesterday: { ar: "أمس", en: "Yesterday" } as Bi,
    last7: { ar: "آخر 7 أيام", en: "Last 7 days" } as Bi,
    total: { ar: "إجمالي الردود", en: "Total replies" } as Bi,
    contacts: { ar: "جهات اتصال مختلفة", en: "Unique contacts" } as Bi,
    status: { ar: "الرد الآلي", en: "Auto-reply" } as Bi,
    on: { ar: "مفعّل", en: "On" } as Bi,
    off: { ar: "موقوف", en: "Off" } as Bi,
    unknown: { ar: "غير معروف", en: "Unknown" } as Bi,
    updated: { ar: "آخر تحديث للرسالة", en: "Message updated" } as Bi,
  },

  chart: {
    title: { ar: "الردود في آخر 14 يومًا", en: "Replies in the last 14 days" } as Bi,
    asTable: { ar: "عرض كجدول", en: "View as table" } as Bi,
    asChart: { ar: "عرض كرسم", en: "View as chart" } as Bi,
    date: { ar: "التاريخ", en: "Date" } as Bi,
    count: { ar: "عدد الردود", en: "Replies" } as Bi,
    series: { ar: "الردود", en: "Replies" } as Bi,
    peak: { ar: "الأعلى", en: "Peak" } as Bi,
    empty: { ar: "لا توجد ردود بعد. عند وصول أول رسالة سيظهر هنا نشاطك.", en: "No replies yet. Your activity appears here once the first message arrives." } as Bi,
  },

  latest: {
    title: { ar: "آخر الردود", en: "Latest replies" } as Bi,
    seeAll: { ar: "عرض السجل كاملًا", en: "View full log" } as Bi,
  },

  reply: {
    title: { ar: "رسالة الرد الآلي", en: "Auto-reply message" } as Bi,
    lead: {
      ar: "تصل هذه الرسالة لكل من يراسلك على واتساب، مرة واحدة لكل رقم في اليوم.",
      en: "Everyone who messages you on WhatsApp gets this once per number per day.",
    } as Bi,
    enable: { ar: "تفعيل الرد الآلي", en: "Turn on auto-reply" } as Bi,
    message: { ar: "نص الرسالة", en: "Message text" } as Bi,
    insert: { ar: "إدراج", en: "Insert" } as Bi,
    nameVar: { ar: "{name} اسم المرسل", en: "{name} sender's name" } as Bi,
    dateVar: { ar: "{date} تاريخ اليوم", en: "{date} today's date" } as Bi,
    templates: { ar: "قوالب جاهزة", en: "Templates" } as Bi,
    tplWelcome: { ar: "ترحيب", en: "Welcome" } as Bi,
    tplSite: { ar: "في الموقع", en: "On site" } as Bi,
    tplHours: { ar: "خارج الدوام", en: "After hours" } as Bi,
    preview: { ar: "معاينة كما تصل للمرسل", en: "Preview as the sender sees it" } as Bi,
    previewName: { ar: "خالد", en: "Khalid" } as Bi,
    save: { ar: "احفظ الرسالة", en: "Save message" } as Bi,
    saving: { ar: "جارٍ الحفظ…", en: "Saving…" } as Bi,
    saved: { ar: "تم حفظ الرسالة", en: "Message saved" } as Bi,
    savedDemo: { ar: "تم الحفظ في الوضع التجريبي فقط (لم يُرسل إلى n8n)", en: "Saved in demo mode only (not sent to n8n)" } as Bi,
    unsaved: { ar: "تعديلات غير محفوظة", en: "Unsaved changes" } as Bi,
    empty: { ar: "اكتب نص الرسالة أولًا.", en: "Write the message text first." } as Bi,
    revert: { ar: "تراجع عن التعديل", en: "Discard changes" } as Bi,
    chars: { ar: "حرف", en: "chars" } as Bi,
    noMessage: { ar: "لا توجد رسالة محفوظة بعد في n8n. اكتب الأولى واحفظها.", en: "No message is saved in n8n yet. Write the first one and save it." } as Bi,
  },

  log: {
    title: { ar: "سجل الردود", en: "Reply log" } as Bi,
    search: { ar: "ابحث بالاسم أو الرقم أو النص", en: "Search by name, number or text" } as Bi,
    range: { ar: "الفترة", en: "Period" } as Bi,
    all: { ar: "الكل", en: "All" } as Bi,
    r7: { ar: "آخر 7 أيام", en: "Last 7 days" } as Bi,
    today: { ar: "اليوم", en: "Today" } as Bi,
    when: { ar: "الوقت", en: "When" } as Bi,
    from: { ar: "المرسل", en: "From" } as Bi,
    incoming: { ar: "رسالته", en: "Their message" } as Bi,
    sent: { ar: "ردّك", en: "Your reply" } as Bi,
    unknownName: { ar: "بلا اسم", en: "No name" } as Bi,
    openChat: { ar: "افتح المحادثة في واتساب", en: "Open chat in WhatsApp" } as Bi,
    copy: { ar: "انسخ الرقم", en: "Copy number" } as Bi,
    copied: { ar: "تم نسخ الرقم", en: "Number copied" } as Bi,
    more: { ar: "عرض المزيد", en: "Show more" } as Bi,
    noResults: { ar: "لا توجد نتائج مطابقة. جرّب كلمة أخرى أو وسّع الفترة.", en: "No matching results. Try another word or widen the period." } as Bi,
    empty: { ar: "السجل فارغ. سيمتلئ عند أول رد آلي يرسله n8n.", en: "The log is empty. It fills when n8n sends the first auto-reply." } as Bi,
    showing: { ar: "عرض", en: "Showing" } as Bi,
    of: { ar: "من", en: "of" } as Bi,
  },

  conn: {
    title: { ar: "الربط مع n8n", en: "n8n connection" } as Bi,
    lead: {
      ar: "هذه اللوحة لا تحتفظ بأي بيانات؛ كل شيء يُقرأ ويُكتب في n8n عبر webhook محمي بمفتاح.",
      en: "This dashboard stores no data; everything is read and written in n8n through a key-protected webhook.",
    } as Bi,
    status: { ar: "الحالة", en: "Status" } as Bi,
    save: { ar: "احفظ واختبر الاتصال", en: "Save and test connection" } as Bi,
    saved: { ar: "تم الاتصال بنجاح", en: "Connected successfully" } as Bi,
    contract: { ar: "شكل الطلبات", en: "Request format" } as Bi,
    links: {
      dashboardWorkflow: { ar: "افتح workflow اللوحة", en: "Open dashboard workflow" } as Bi,
      dataTables: { ar: "افتح جداول البيانات", en: "Open data tables" } as Bi,
      autoReplyWorkflow: { ar: "افتح workflow الرد الآلي", en: "Open auto-reply workflow" } as Bi,
      credentials: { ar: "افتح بيانات الاعتماد", en: "Open credentials" } as Bi,
      meta: { ar: "تطبيق Meta (واتساب)", en: "Meta app (WhatsApp)" } as Bi,
    },
    steps: {
      publish: {
        ar: "في n8n: افتح workflow «واجهة لوحة التحكم – أحمد» ثم انشره (Publish).",
        en: "In n8n: open the “Ahmed – Dashboard API” workflow and publish it.",
      } as Bi,
      key: {
        ar: "افتح جدول البيانات dashboard_config وضع مفتاحك السري في صف api_key (بدل CHANGE_ME). اختر نصًا طويلًا وعشوائيًا.",
        en: "Open the dashboard_config data table and put your secret key in the api_key row (replace CHANGE_ME). Use a long random string.",
      } as Bi,
      whatsapp: {
        ar: "اربط بيانات اعتماد WhatsApp Business Cloud في workflow «واتساب – الرد الآلي برسالة اليوم» ثم انشره ليبدأ الرد على رسائلك.",
        en: "Attach WhatsApp Business Cloud credentials in the “WhatsApp – daily auto-reply” workflow and publish it so it starts replying.",
      } as Bi,
      connect: {
        ar: "أدخل رابط الـ webhook والمفتاح في الحقلين أعلاه واضغط «احفظ واختبر الاتصال».",
        en: "Enter the webhook URL and key above and press “Save and test connection”.",
      } as Bi,
    },
  },
};
