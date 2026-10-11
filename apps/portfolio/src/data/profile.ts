// المحتوى كله هنا (عربي + إنجليزي). عدّل هذا الملف فقط لتغيير نصوص الموقع.
// المصدر: السيرة الذاتية (cv_ahmedhassanien_English_2026.pdf) + تعليمات صاحب الموقع.
// ⚠️ بنود عليها علامة VERIFY أرقام أو بيانات وردت في الطلب ولا يؤيدها ملف السيرة الذاتية — راجعها قبل النشر.

import type { Bi } from "../i18n/lang";

export const person = {
  name: { ar: "أحمد ممدوح زهران", en: "Ahmed Mamdouh Zahran" } as Bi,
  shortName: { ar: "أحمد زهران", en: "Ahmed Zahran" } as Bi,
  title: {
    ar: "مدير مشاريع ومهندس طاقة كهربائية",
    en: "Senior Project Manager & Electrical Power Engineer",
  } as Bi,
  org: {
    ar: "شركة وبران — عقود الشركة السعودية للكهرباء",
    en: "Wabran Company — Saudi Electricity Company (SEC) contracts",
  } as Bi,
  // VERIFY: السيرة الذاتية تذكر نجران، والطلب ذكر الرياض/الشرقية.
  location: { ar: "المملكة العربية السعودية — نجران", en: "Kingdom of Saudi Arabia — Najran" } as Bi,
  badge: {
    ar: "متاح لمشاريع تنفيذية واستشارات",
    en: "Available for Executive Projects & Consultation",
  } as Bi,
  summary: {
    ar: "أقود مشاريع شبكات التوزيع والمحطات الكهربائية من التخطيط حتى التشغيل، بخبرة تتجاوز 15 عامًا في عقود الشركة السعودية للكهرباء: التزام بالجدول والميزانية، وسلامة وجودة بلا تنازل.",
    en: "I lead power-distribution and substation projects from planning to energisation — 15+ years delivering Saudi Electricity Company contracts on schedule, on budget and safely.",
  } as Bi,
};

export type Metric = { value: number; prefix?: string; suffix?: string; decimals?: number; label: Bi };

// VERIFY: 120+ و $50M+ و 99.8% وردت في الطلب. السيرة الذاتية تذكر «ميزانيات تتجاوز 25 مليون ريال» ولا تذكر عدد المشاريع ولا نسبة السلامة.
export const metrics: Metric[] = [
  { value: 15, suffix: "+", label: { ar: "سنوات خبرة", en: "Years of experience" } },
  { value: 120, suffix: "+", label: { ar: "مشروع بنية تحتية منجز", en: "Infrastructure projects delivered" } },
  { value: 50, prefix: "$", suffix: "M+", label: { ar: "ميزانيات مشاريع مُدارة", en: "Project budgets managed" } },
  { value: 99.8, suffix: "%", decimals: 1, label: { ar: "سجل السلامة والجودة", en: "Safety & compliance record" } },
];

export type Capability = { icon: "gantt" | "contract" | "grid" | "wallet" | "mentor" | "shield"; title: Bi; text: Bi };

export const capabilities: Capability[] = [
  {
    icon: "gantt",
    title: { ar: "إدارة المشاريع الاستراتيجية", en: "Strategic project management" },
    text: {
      ar: "منهجية PMP في التخطيط والجدولة ومتابعة الإنجاز، مع تقارير دورية للإدارة العليا.",
      en: "PMP methodology for planning, scheduling and progress control, with periodic reports to senior management.",
    },
  },
  {
    icon: "contract",
    title: { ar: "تنفيذ العقود الموحدة للشركة السعودية للكهرباء", en: "SEC unified contract execution" },
    text: {
      ar: "إشراف كامل على تنفيذ العقود الموحدة وفق شروط FIDIC، والتنسيق مع المقاولين والاستشاريين والجهات الحكومية.",
      en: "End-to-end supervision of unified contracts under FIDIC conditions, coordinating contractors, consultants and authorities.",
    },
  },
  {
    icon: "grid",
    title: { ar: "شبكات التوزيع وتشغيل المحطات", en: "Distribution networks & substation commissioning" },
    text: {
      ar: "كابلات الجهد المتوسط والمنخفض (13.8 و33 ك.ف)، وتحويل الشبكات، واختبار وتشغيل المحطات.",
      en: "MV/LV cable networks (13.8 and 33 kV), network conversion, and substation testing and energisation.",
    },
  },
  {
    icon: "wallet",
    title: { ar: "الميزانيات والمشتريات وإدارة المخاطر", en: "Budgets, procurement & risk mitigation" },
    text: {
      ar: "ضبط التكاليف، وتقييم المواد فنيًا وفق مواصفات الشركة السعودية للكهرباء، وخطط تقييم المخاطر.",
      en: "Cost control, technical evaluation of materials against SEC specifications, and risk-assessment plans.",
    },
  },
  {
    icon: "shield",
    title: { ar: "السلامة والجودة", en: "Safety & quality compliance" },
    text: {
      ar: "التزام صارم بمعايير السلامة والجودة، وشهادة السلامة والصحة المهنية المعتمدة من الشركة السعودية للكهرباء.",
      en: "Strict safety and quality standards, backed by SEC-certified occupational health & safety training.",
    },
  },
  {
    icon: "mentor",
    title: { ar: "مدرّب فني ومرشد هندسي", en: "Technical trainer & engineering mentor" },
    text: {
      ar: "تدريب المهندسين والفنيين، وبناء فرق صيانة وتشغيل قادرة على العمل باستقلالية.",
      en: "Training engineers and technicians, and building maintenance and operations teams that work independently.",
    },
  },
];

export const tools = [
  "AutoCAD",
  "DIALux",
  "ETAP",
  "Primavera",
  "MS Excel & Power Query",
  "MS Office",
  "IFMS",
  "UDS",
];

export const languages = [
  { name: { ar: "العربية", en: "Arabic" } as Bi, level: { ar: "لغة أم", en: "Native" } as Bi, score: 5 },
  { name: { ar: "الإنجليزية", en: "English" } as Bi, level: { ar: "عمل احترافي", en: "Professional working" } as Bi, score: 3 },
];

export type Role = {
  id: string;
  period: Bi;
  title: Bi;
  org: Bi;
  place?: Bi;
  current?: boolean;
  points: Bi<string[]>;
};

export const roles: Role[] = [
  {
    id: "wabran",
    period: { ar: "2021 — الآن", en: "2021 — Present" },
    title: { ar: "مدير مشاريع", en: "Project Manager" },
    org: { ar: "شركة وبران — عقود الشركة السعودية للكهرباء", en: "Wabran Company — Saudi Electricity Company (SEC)" },
    place: { ar: "نجران، المملكة العربية السعودية", en: "Najran, Saudi Arabia" },
    current: true,
    points: {
      ar: [
        "منذ 2023: الإشراف الكامل على تنفيذ مشاريع العقد الموحد.",
        "التنسيق بين المقاولين والاستشاريين والجهات الحكومية لاستخراج التصاريح والموافقات.",
        "متابعة الجداول الزمنية والميزانيات وضبط التكاليف — ميزانيات تتجاوز 25 مليون ريال.",
        "إعداد التقارير الدورية للإدارة العليا.",
        "ضمان الالتزام بمعايير السلامة والجودة، والتقييم الفني للمواد وفق مواصفات الشركة السعودية للكهرباء.",
        "إعداد خطط تقييم المخاطر وإدارة المعالجات لاستمرار تقدم العمل.",
      ],
      en: [
        "Since 2023: full supervision of unified-contract project execution.",
        "Coordinating contractors, consultants and governmental authorities to secure permits and approvals.",
        "Tracking timelines, budgets and cost control — budgets exceeding SAR 25 million.",
        "Preparing periodic reports for upper management.",
        "Enforcing safety and quality standards and evaluating materials against SEC specifications.",
        "Running risk-assessment plans and mitigation to keep delivery moving.",
      ],
    },
  },
  {
    id: "scedc",
    period: { ar: "2013 — 2021", en: "2013 — 2021" },
    title: { ar: "مهندس كهرباء — اختبار وتحديد أعطال الكابلات والمحولات", en: "Electrical Engineer — Cable & Transformer Test / Fault Location" },
    org: { ar: "جنوب القاهرة لتوزيع الكهرباء", en: "South Cairo Electricity Distribution" },
    place: { ar: "القاهرة، مصر", en: "Cairo, Egypt" },
    points: {
      ar: [
        "تصميم المخططات أحادية الخط لكابلات الجهد المنخفض والمتوسط ورسومات الورش.",
        "اختبار وتحديد أعطال كابلات الجهد العالي والمتوسط والمنخفض والمحولات بعربة اختبار على جهود 13.8 و33 ك.ف، بطرق ICE وARM وARM Burning وDecay.",
        "صيانة كابلات الجهد المتوسط (وصلات الزيت وXLPE والنهايات) واختبار مكونات الشبكة: محولات القدرة ومحولات الجهد والتيار وقواطع SF6 ووحدات RMU ولوحات التوزيع.",
        "الصيانة التنبؤية بالتصوير الحراري (FLIR) ومعالجة النتائج.",
        "مهندس وردية وصيانة: قيادة فرق صيانة شبكة الجهد المنخفض، وإدارة مواقع الإنشاء.",
      ],
      en: [
        "Designed single-line diagrams for LV and MV cables and electrical shop drawings.",
        "Tested and located faults on HV/MV/LV cables and transformers using a test van (ICE, ARM, ARM burning, decay) at 13.8 and 33 kV.",
        "Maintained MV cables (oil and XLPE joints, terminations) and tested network components: power transformers, VT/CT, SF6 breakers, RMUs and switchgear.",
        "Predictive maintenance with FLIR thermal imaging and follow-up of findings.",
        "Shift and maintenance engineer: led LV network maintenance teams and directed work on construction sites.",
      ],
    },
  },
  {
    id: "rtc",
    period: { ar: "التدريب الفني", en: "Technical training" },
    title: { ar: "مدرّب فني", en: "Technical Trainer" },
    org: { ar: "RTC حلوان", en: "RTC Helwan" },
    place: { ar: "حلوان، مصر", en: "Helwan, Egypt" },
    points: {
      ar: ["نقل خبرة الشبكات والمحولات والاختبارات الميدانية إلى المهندسين والفنيين الجدد."],
      en: ["Passed on field experience in networks, transformers and testing to new engineers and technicians."],
    },
  },
  {
    id: "edu",
    period: { ar: "2011", en: "2011" },
    title: { ar: "بكالوريوس هندسة القوى والآلات الكهربائية", en: "B.Sc. Electrical Power & Machines Engineering" },
    org: { ar: "جامعة حلوان", en: "Helwan University" },
    place: { ar: "مصر", en: "Egypt" },
    points: {
      ar: ["تقدير عام: جيد — مشروع التخرج: ممتاز."],
      en: ["Overall grade: Good — graduation project: Excellent."],
    },
  },
];

export type Project = { id: string; title: Bi; scope: Bi; places?: Bi<string[]>; tag: Bi };

// أسماء المواقع بالعربية نقحرة من الكتابة اللاتينية في السيرة الذاتية — VERIFY الإملاء.
export const projects: Project[] = [
  {
    id: "najran-conversion",
    tag: { ar: "تحويل الشبكات", en: "Network conversion" },
    title: { ar: "مشاريع تحويل شبكة نجران", en: "Najran network conversion projects" },
    scope: {
      ar: "تحويل شبكات التوزيع في ست مناطق ضمن عقد موحد للشركة السعودية للكهرباء.",
      en: "Distribution-network conversion across six areas under an SEC unified contract.",
    },
    places: {
      ar: ["الشرفة", "العزيزية", "يدمة", "الفهد", "العريسية", "خباش"],
      en: ["Al-Shurfa", "Al-Aziziyah", "Yadmah", "Al-Fahd", "Al-Araysiyah", "Khubash"],
    },
  },
  {
    id: "interconnection",
    tag: { ar: "مغذيات الربط", en: "Interconnection feeders" },
    title: { ar: "مغذيات الربط بين المحطات", en: "Interconnection feeder projects" },
    scope: {
      ar: "تنفيذ مغذيات الربط بين محطات الأخدود ودار الجنوب والحضن.",
      en: "Implementation of interconnection feeders between the Al-Akhdoud, Dar Al-Janoub and Al-Hadn substations.",
    },
  },
  {
    id: "nuqayha",
    tag: { ar: "محطة", en: "Substation" },
    title: { ar: "محطة النقيحة", en: "Al-Nuqayha substation" },
    scope: { ar: "تنفيذ المحطة وتسليمها.", en: "Implementation and handover of the substation." },
  },
  {
    id: "akhdoud",
    tag: { ar: "كابلات واختبارات", en: "Cables & testing" },
    title: { ar: "كابلات محطة الأخدود", en: "Al-Akhdoud substation cables" },
    scope: { ar: "تنفيذ واختبار كابلات المحطة.", en: "Implementation and testing of the substation cables." },
  },
  {
    id: "thermal",
    tag: { ar: "صيانة تنبؤية", en: "Predictive maintenance" },
    title: { ar: "المسح الحراري والصيانة", en: "Thermal scanning & maintenance" },
    scope: { ar: "المسح الحراري والصيانة لجميع أنواع المعدات.", en: "Thermal scanning and maintenance for all equipment types." },
  },
];

export type Credential = {
  id: string;
  kind: "education" | "certificate" | "course" | "experience";
  status: "earned" | "in-progress";
  title: Bi;
  issuer: Bi;
  note?: Bi;
};

export const credentials: Credential[] = [
  {
    id: "bsc",
    kind: "education",
    status: "earned",
    title: { ar: "بكالوريوس هندسة القوى والآلات الكهربائية", en: "B.Sc. Electrical Power & Machines Engineering" },
    issuer: { ar: "جامعة حلوان — يونيو 2011", en: "Helwan University — June 2011" },
    note: { ar: "تقدير عام: جيد · مشروع التخرج: ممتاز", en: "Overall: Good · Graduation project: Excellent" },
  },
  {
    // السيرة الذاتية: «Pmp course 2025» و«Continuing education in PMP certified» — لم تُذكر شهادة مكتسبة.
    // عند الحصول على الشهادة غيّر status إلى "earned".
    id: "pmp",
    kind: "certificate",
    status: "in-progress",
    title: { ar: "PMP®\u200E — محترف إدارة المشاريع", en: "PMP® — Project Management Professional" },
    issuer: { ar: "معهد إدارة المشاريع (PMI)", en: "Project Management Institute (PMI)" },
    note: { ar: "أتمّ دورة 2025 · الشهادة قيد الإعداد", en: "2025 course completed · certification in progress" },
  },
  {
    id: "ohs",
    kind: "certificate",
    status: "earned",
    title: { ar: "السلامة والصحة المهنية (HSE)", en: "Occupational Health, Safety & Environment (HSE)" },
    issuer: { ar: "معتمدة من الشركة السعودية للكهرباء", en: "SEC certified" },
  },
  {
    id: "isolation",
    kind: "certificate",
    status: "earned",
    title: { ar: "دورة السلامة والعزل الآمن", en: "Safety & Secure Isolation course" },
    issuer: { ar: "الشركة السعودية للكهرباء — أبها", en: "Saudi Electricity Company — Abha" },
  },
  {
    id: "firstaid",
    kind: "certificate",
    status: "earned",
    title: { ar: "الإسعافات الأولية", en: "First Aid" },
    issuer: { ar: "هيئة الهلال الأحمر السعودي", en: "Saudi Red Crescent Authority" },
  },
  {
    id: "data",
    kind: "course",
    status: "earned",
    title: { ar: "تحليل البيانات بـ Excel وPower Query", en: "Data analysis with Excel & Power Query" },
    issuer: { ar: "دورة تدريبية", en: "Training course" },
  },
  {
    id: "trainer",
    kind: "experience",
    status: "earned",
    title: { ar: "مدرّب فني", en: "Technical trainer" },
    issuer: { ar: "RTC حلوان", en: "RTC Helwan" },
  },
];

export const trainingCourses: Bi<string[]> = {
  ar: [
    "SCADA",
    "PLC (Siemens S7-300 · LG KGL/Logix Pro)",
    "Primavera",
    "AutoCAD الكهربائي (جامعة القاهرة)",
    "التحكم الآلي ومراقبة المصاعد",
    "توزيع الكهرباء — نقابة المهندسين المصرية",
    "الشهادة الدولية ICDL",
    "المكتب الفني",
  ],
  en: [
    "SCADA",
    "PLC (Siemens S7-300 · LG KGL/Logix Pro)",
    "Primavera",
    "Electrical AutoCAD (Cairo University)",
    "Automatic control & elevator control",
    "Electric distribution — Egyptian Engineers Syndicate",
    "ICDL certification",
    "Technical office",
  ],
};
