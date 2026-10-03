// قاعدة بيانات البنود — العقد الموحد SEC (أسعار 2023 المعتمدة) مستخرجة من ملفات مشروع الحصينية 234022308.
// مولَّد آليًا من reference/legacy.html (السطور 436–679) — لا تعدّل الأرقام يدويًا.
import type { Material, Work, Factors, SheetFieldGroup, AuthorityStep } from "./types";

export const MATERIALS: Material[] = [
 // code, ar, en, unit, price(SAR), class: main|detail, group
 {c:"8114005", ar:"كابل ج.متوسط 36ك.ف ألمنيوم 3×400/35مم² XLPE", en:"CABLE,PWR,36KV,AL,3X400/35MM2,XLPE", u:"م", p:118.5, k:"main", g:"cables"},
 {c:"8111007", ar:"كابل ج.منخفض 600/1000ف ألمنيوم 4×300مم²", en:"CABLE,PWR,600V/1KV,AL,4C,300MM2", u:"م", p:44.2, k:"main", g:"cables"},
 {c:"8111006", ar:"كابل ج.منخفض 600/1000ف ألمنيوم 4×185مم²", en:"CABLE,PWR,600V/1KV,AL,4C,185MM2", u:"م", p:29.8, k:"main", g:"cables"},
 {c:"8111005", ar:"كابل ج.منخفض 600/1000ف ألمنيوم 4×70مم²", en:"CABLE,PWR,600V/1KV,AL,4C,70MM2", u:"م", p:19.36, k:"main", g:"cables"},
 {c:"8113009", ar:"كابل ج.متوسط 36ك.ف نحاس أحادي 50/16مم²", en:"CABLE,PWR,36KV,CU,1C,50/16MM2,XP", u:"م", p:61.0, k:"main", g:"cables"},
 {c:"8327004", ar:"وحدة حلقية RMU غاز SF6 33ك.ف 3 مسارات", en:"RMU,SF6,33KV,400A,CB,3WAY,NON-EX", u:"عدد", p:64500, k:"main", g:"equip"},
 {c:"8327005", ar:"وحدة حلقية RMU غاز SF6 33ك.ف 4 مسارات (3L+1C)", en:"RMU,SF6,33KV,400A,CB,4WAY,3L+1C", u:"عدد", p:78900, k:"main", g:"equip"},
 {c:"8567054", ar:"محطة وحدة 500ك.ف.أ ألمنيوم 33/0.4ك.ف", en:"TFMR,UNIT SUB,500KVA,AL,33KV", u:"عدد", p:86400, k:"main", g:"equip"},
 {c:"8569108", ar:"محطة وحدة 500ك.ف.أ 33ك.ف 400/230ف 4 دوائر", en:"TFMR,U/S,500KVA,33KV,400/230V,4C", u:"عدد", p:91200, k:"main", g:"equip"},
 {c:"8569116", ar:"محطة وحدة 1 م.ف.أ ألمنيوم 33ك.ف 6 قواطع 400A", en:"TFMR,U/S,1MVA,AL,33KV,6MCCB 400A", u:"عدد", p:138500, k:"main", g:"equip"},
 {c:"8121179", ar:"طقم وصلة مستقيمة كابل 36ك.ف 3×400/35 ألمنيوم", en:"SPLICE KIT,STR,36KV,3X400/35,AL", u:"عدد", p:935.45, k:"detail", g:"acc"},
 {c:"8121182", ar:"كوع نهاية طرفية 36ك.ف 630A 3×400/35 ألمنيوم", en:"ELBOW,EC,36KV,630A,3X400/35MM2,AL", u:"عدد", p:1245, k:"detail", g:"acc"},
 {c:"8121139", ar:"كوع نهاية طرفية 36ك.ف 630A 1×50/16 نحاس", en:"ELBOW,EC,36KV,630A,1X50/16MM2,CU", u:"عدد", p:742, k:"detail", g:"acc"},
 {c:"8121008", ar:"طقم نهاية طرفية كابل حراري/بارد ج.متوسط", en:"TERMINATION KIT,HEAT/COLD SHRINK", u:"عدد", p:865, k:"detail", g:"acc"},
 {c:"8121009", ar:"طقم نهاية طرفية 1ك.ف 4×185مم² ألمنيوم", en:"TERM KIT,STR,1KV,4X185MM2,AL", u:"عدد", p:186, k:"detail", g:"acc"},
 {c:"8121010", ar:"طقم نهاية طرفية 1ك.ف 4×300مم² ألمنيوم", en:"TERM KIT,STR,1KV,4X300MM2,AL", u:"عدد", p:238, k:"detail", g:"acc"},
 {c:"8111102", ar:"موصل نحاس عاري 70مم² 19 سلك (تأريض)", en:"COND,BR,CU,70SQMM,19STR,SOFT DRWN", u:"م", p:52.4, k:"detail", g:"earth"},
 {c:"8111101", ar:"موصل نحاس عاري 35مم² 7 أسلاك (تأريض)", en:"COND,BR,CU,35SQMM,7STR,SOFT DRWN", u:"م", p:27.1, k:"detail", g:"earth"},
 {c:"8202054", ar:"قضيب تأريض 16مم قطر × 2400مم", en:"ROD,GROUND,16MM DIA X 2400MM L", u:"عدد", p:96.5, k:"detail", g:"earth"},
 {c:"8202189", ar:"وصلة تأريض نوع C نحاس 100-125مم²", en:"CONNECTOR,GRNDG,C,CU,100-125SQMM", u:"عدد", p:34.8, k:"detail", g:"earth"},
 {c:"8202098", ar:"مشبك تأريض برونز 35-70مم² نحاس / 16مم", en:"CLAMP,GRD,BRZ,35-70SQMM CU,16MM", u:"عدد", p:41.2, k:"detail", g:"earth"},
 {c:"8202030", ar:"وصلة طرفية نحاس مجدول 35مم²", en:"CONN,ELEC,TERM,CU STR,35SQMM CND", u:"عدد", p:22.6, k:"detail", g:"earth"},
 {c:"8122034", ar:"وصلة طرفية نحاس 70مم²", en:"CONN,ELEC,TERM,CU,70SQMM CNDCTR", u:"عدد", p:28.9, k:"detail", g:"earth"},
];

export const WORKS: Work[] = [
 {c:"301010101", ar:"حفر مسار كابل ج.منخفض والردم (1–3) كابل، تربة عادية/رملية غير مسفلتة", en:"LV trench 1–3 cables, sandy, unpaved", u:"م", p:41, g:"exc"},
 {c:"301010102", ar:"حفر مسار كابل ج.منخفض والردم (4) كابل، تربة عادية/رملية غير مسفلتة", en:"LV trench 4 cables, sandy, unpaved", u:"م", p:52, g:"exc"},
 {c:"301010103", ar:"حفر مسار كابل ج.منخفض والردم (1–3) كابل، تربة مسفلتة", en:"LV trench 1–3 cables, asphalt", u:"م", p:46, g:"exc"},
 {c:"301010201", ar:"حفر مسار كابل ج.متوسط والردم (1) كابل، تربة عادية/رملية غير مسفلتة", en:"MV trench 1 cable, sandy, unpaved", u:"م", p:42, g:"exc"},
 {c:"301010202", ar:"حفر مسار كابل ج.متوسط والردم (2) كابل، غير مسفلتة", en:"MV trench 2 cables, unpaved", u:"م", p:53, g:"exc"},
 {c:"301010203", ar:"حفر مسار كابل ج.متوسط والردم (3) كابل، غير مسفلتة", en:"MV trench 3 cables, unpaved", u:"م", p:67, g:"exc"},
 {c:"301010204", ar:"حفر مسار كابل ج.متوسط والردم (4) كابل، غير مسفلتة", en:"MV trench 4 cables, unpaved", u:"م", p:83, g:"exc"},
 {c:"301010205", ar:"حفر مسار كابل ج.متوسط والردم (1) كابل، تربة مسفلتة", en:"MV trench 1 cable, asphalt", u:"م", p:47, g:"exc"},
 {c:"301010206", ar:"حفر مسار كابل ج.متوسط والردم (2) كابل، تربة مسفلتة", en:"MV trench 2 cables, asphalt", u:"م", p:62, g:"exc"},
 {c:"301010308", ar:"إعادة ردم ودك في مسار الكابلات لمواقع مرصوفة بالبلاط/الخرسانة", en:"Backfill & compaction, tiled/concrete areas", u:"م²", p:44.94, g:"exc"},
 {c:"302010002", ar:"توريد وتمديد مواسير PVC 150–200مم (6\") صنف 4 لعبور الشوارع ج.متوسط", en:"PVC duct 6\" class 4, road crossing MV", u:"م", p:53, g:"duct"},
 {c:"302020001", ar:"توريد وتمديد عدد (1) ماسورة بولي إثيلين بطريقة الثقب الأفقي", en:"1 HDPE duct by horizontal directional drilling", u:"م", p:1368, g:"duct"},
 {c:"505020002", ar:"توريد ماسورة PVC حتى 3 بوصة لحماية كابل على جدار", en:"PVC pipe ≤3\" wall cable protection", u:"م", p:28, g:"duct"},
 {c:"304010101", ar:"تمديد كابل رباعي ج.منخفض ≤185مم²", en:"Lay LV 4-core cable ≤185mm²", u:"م", p:8, g:"lay"},
 {c:"304010102", ar:"تمديد كابل رباعي ج.منخفض >185 ≤500مم²", en:"Lay LV 4-core cable >185 ≤500mm²", u:"م", p:9, g:"lay"},
 {c:"304010202", ar:"تمديد كابل ثلاثي ج.متوسط >185 ≤500مم²", en:"Lay MV 3-core cable >185 ≤500mm²", u:"م", p:11, g:"lay"},
 {c:"304010203", ar:"تمديد كابل أحادي ج.متوسط ≤185مم²", en:"Lay MV single-core cable ≤185mm²", u:"م", p:7, g:"lay"},
 {c:"304040201", ar:"مبلغ إضافي عند تمديد كابل ج.متوسط/منخفض للتوصيل لمعدة هوائية", en:"Extra for connection to overhead equipment", u:"عدد", p:48, g:"lay"},
 {c:"305010301", ar:"تركيب نهاية طرفية كابل ج.منخفض رباعي ≤185مم² شاملاً المرابط", en:"LV termination 4-core ≤185mm²", u:"عدد", p:186, g:"term"},
 {c:"305010302", ar:"تركيب نهاية طرفية كابل ج.منخفض رباعي >185مم² شاملاً المرابط", en:"LV termination 4-core >185mm²", u:"عدد", p:248, g:"term"},
 {c:"305010102", ar:"عمل وصلة مستقيمة كابل ج.منخفض رباعي >185مم²", en:"LV straight joint 4-core >185mm²", u:"عدد", p:323, g:"term"},
 {c:"305010401", ar:"تركيب مرابط رأس (عدد 4) لكابل ج.منخفض رباعي لمعدة/عداد قائم", en:"4 cable lugs, LV 4-core to existing equipment", u:"عدد", p:113, g:"term"},
 {c:"305020104", ar:"عمل وصلة مستقيمة كابل ثلاثي القلب 36ك.ف >185 ≤500مم²", en:"MV straight joint 3-core 36kV >185 ≤500mm²", u:"عدد", p:883, g:"term"},
 {c:"305020404", ar:"تركيب نهاية طرفية مستقيمة/زاوية قائمة كابل ثلاثي 36ك.ف >185 ≤500", en:"MV indoor/outdoor termination 3-core 36kV", u:"عدد", p:810, g:"term"},
 {c:"305020407", ar:"تركيب نهاية طرفية كوعية للفازة الواحدة، كابل ج.متوسط أي مقاس", en:"MV elbow termination per phase", u:"عدد", p:348, g:"term"},
 {c:"306010002", ar:"إعادة سفلتة حفريات طرق تابعة لوزارة النقل/الأمانة", en:"Asphalt reinstatement", u:"م²", p:112, g:"asph"},
 {c:"306010004", ar:"كشط وإعادة السفلتة باستخدام الفرّادة", en:"Milling & asphalt reinstatement", u:"م²", p:77, g:"asph"},
 {c:"308020101", ar:"توريد وتركيب قاعدة خرسانية لمفاتيح حلقية/وحدة قياس ج.متوسط", en:"RMU / metering unit concrete foundation", u:"عدد", p:796, g:"civil"},
 {c:"308020105", ar:"توريد وتركيب قاعدة خرسانية لمحطة وحدة ≤1000ك.ف.أ", en:"Unit substation foundation ≤1000kVA", u:"عدد", p:2808, g:"civil"},
 {c:"401000015", ar:"توريد وصب خرسانة إسمنتية عادية", en:"Plain concrete supply & pour", u:"م³", p:297, g:"civil"},
 {c:"309010102", ar:"تركيب لوحة توزيع فرعية من الألياف الزجاجية بقاعدتها", en:"GRP LV distribution pillar with base", u:"عدد", p:362, g:"inst"},
 {c:"309020101", ar:"تركيب وحدة حلقات رئيسية/وحدة قياس/مفاتيح تحويل آلية ج.متوسط", en:"Install RMU / metering / auto-transfer unit", u:"عدد", p:610, g:"inst"},
 {c:"309020203", ar:"تركيب محطة وحدة ≤1000ك.ف.أ", en:"Install unit substation ≤1000kVA", u:"عدد", p:1565, g:"inst"},
 {c:"310010001", ar:"تأريض لوحة توزيع رئيسية/فرعية بعدد (2) قضيب تأريض", en:"Earthing LV pillar, 2 rods", u:"عدد", p:157, g:"earth"},
 {c:"310020001", ar:"تأريض معدات أرضية في حيز/غرفة بعدد (4) قضبان تأريض", en:"Earthing ground equipment, 4 rods", u:"عدد", p:260, g:"earth"},
 {c:"207000006", ar:"تأريض معدة هوائية مركبة على عمود/عمودين أو كابل صاعد", en:"Earthing overhead equipment / riser", u:"عدد", p:334, g:"earth"},
 {c:"604000002", ar:"توريد وتركيب عمود حماية واحد لمعدة أرضية/عمود هوائي قائم", en:"Supply & install 1 protection bollard", u:"عدد", p:305, g:"prot"},
 {c:"205010302", ar:"تركيب مانعات صواعق أو منصهرات ج.متوسط ثلاثية الأطوار", en:"Install MV arresters / fuses, 3-phase", u:"عدد", p:241, g:"prot"},
 {c:"201010103", ar:"تركيب عمود حديدي >10م حتى 15م، تربة عادية/رملية", en:"Install steel pole >10m ≤15m", u:"عدد", p:1253, g:"oh"},
 {c:"202010203", ar:"هيكلة عمود ج.متوسط دائرة مفردة، عمود بداية/نهاية", en:"MV single-circuit pole framing, terminal", u:"عدد", p:142, g:"oh"},
 {c:"201040003", ar:"إزالة عمود حديدي/داعم بقطع العمود", en:"Remove steel pole / stay", u:"عدد", p:358, g:"rem"},
 {c:"201040006", ar:"إزالة عمود خشبي أي مقاس وأي تربة", en:"Remove wooden pole, any size", u:"عدد", p:334, g:"rem"},
 {c:"204010301", ar:"إزالة 4 أسلاك معزولة/مجدول دائرة مفردة ج.منخفض", en:"Remove LV ABC / insulated 4-wire", u:"م", p:4, g:"rem"},
 {c:"204020301", ar:"إزالة موصلات دائرة مفردة ج.متوسط أي مقاس", en:"Remove MV single-circuit conductors", u:"م", p:5, g:"rem"},
 {c:"205040101", ar:"إزالة محول هوائي 3 أطوار على عمود واحد أي سعة", en:"Remove pole-mounted TR (1 pole)", u:"عدد", p:602, g:"rem"},
 {c:"205040102", ar:"إزالة محول هوائي 3 أطوار على عمودين أي سعة", en:"Remove pole-mounted TR (2 poles)", u:"عدد", p:719, g:"rem"},
 {c:"205040206", ar:"إزالة مفتاح فصل خط على الحمل بكامل الملحقات", en:"Remove LBS with accessories", u:"عدد", p:689, g:"rem"},
 {c:"304040205", ar:"إزالة كابل ج.متوسط/منخفض صاعد على عمود", en:"Remove riser cable on pole", u:"عدد", p:33, g:"rem"},
 {c:"307010002", ar:"اختبار الكثافة القصوى للتربة (بروكتر Proctor)", en:"Proctor maximum dry density test", u:"عدد", p:187, g:"test"},
 {c:"307010005", ar:"اختبار دك التربة للكثافة الحقلية", en:"Field density compaction test", u:"عدد", p:92, g:"test"},
 {c:"307040002", ar:"تعيين نسبة الأسفلت والتدرج الحبيبي", en:"Asphalt content & gradation test", u:"عدد", p:204, g:"test"},
 {c:"311000016", ar:"اختبار كابل ج.متوسط بالموجات ذات التردد المنخفض VLF وتقديم التقارير", en:"MV cable VLF test & reporting", u:"عدد", p:2939, g:"test"},
];

export const DEFAULT_FACTORS: Factors = {
  drumLen:1000,        // طول بكرة كابل ج.متوسط (م) → عدد الوصلات المستقيمة
  cuPerRMU:25,         // موصل نحاس 70مم² لكل RMU (م)
  cuPerTR:25,          // موصل نحاس 35مم² لكل محطة وحدة (م)
  rodsPerRMU:4,        // قضبان تأريض لكل RMU
  rodsPerTR:5,         // قضبان تأريض لكل محطة وحدة
  rodsPerPillar:2,     // قضبان تأريض لكل لوحة توزيع
  cConnPerRMU:5,       // وصلات C لكل RMU
  luPerRMU:4,          // وصلات طرفية نحاس 70 لكل RMU
  clampPerTR:5,        // مشابك تأريض لكل محطة وحدة
  connPerTR:5,         // وصلات طرفية نحاس 35 لكل محطة وحدة
  elbowPerTR:3,        // أكواع 3×400 لكل محطة وحدة (فازة/كوع)
  elbowPhases:3,       // أكواع لكل نهاية كوعية
  bollardPerRMU:4,     // أعمدة حماية لكل معدة أرضية
  wastePct:2,          // نسبة الهالك/الفاقد للكابلات %
  indirectPct:23.5,    // التكاليف غير المباشرة %
  trenchWidthLV:0.4,   // عرض حفر ج.منخفض (م)
  trenchWidthMV:0.6,   // عرض حفر ج.متوسط (م)
  vlfPerSection:1      // اختبار VLF لكل قطعة كابل ج.متوسط
};

export const HASSINIYA_SHEETS: Record<string, any>[] = [
 {name:"لوحة 1", rmu3w:3, rmu4w:5, rmuEx:0, tr220:3, tr400:2, trIndoor:2, trEx:0, pillars:2,
  htCable:4820, htEarth:24, mvSingle:48, lt300:328, lt185:15, lt70:0,
  asHT1:572, saHT1:2006, asHT2:105, saHT2:185, asHT3:0, saHT3:21, saHT4:0,
  asLT13:29, saLT13:125, saLT4:0, asphalt:706, milling:0, hdd:0,
  poleSteel:14, poleWood:12, trPole1:11, trPole2:9, condMV:4800, abcLV:1400, riserRem:7, lbsRem:1,
  term3x400:34, lt300Term:14, lt185Term:16, lt70Term:0, joints:5, riser400:3},
 {name:"لوحة 2", rmu3w:4, rmu4w:3, rmuEx:1, tr220:0, tr400:0, trIndoor:0, trEx:0, pillars:3,
  htCable:4150, htEarth:24, mvSingle:24, lt300:158, lt185:0, lt70:13,
  asHT1:369, saHT1:5344, asHT2:7, saHT2:283, asHT3:0, saHT3:31, saHT4:9,
  asLT13:17, saLT13:5, saLT4:0, asphalt:0, milling:250, hdd:0,
  poleSteel:16, poleWood:11, trPole1:9, trPole2:8, condMV:4400, abcLV:1200, riserRem:6, lbsRem:0,
  term3x400:27, lt300Term:0, lt185Term:0, lt70Term:0, joints:6, riser400:3},
 {name:"لوحة 3", rmu3w:3, rmu4w:6, rmuEx:2, tr220:1, tr400:2, trIndoor:0, trEx:1, pillars:2,
  htCable:4530, htEarth:24, mvSingle:36, lt300:707, lt185:5, lt70:11,
  asHT1:179, saHT1:3964, asHT2:0, saHT2:175, asHT3:0, saHT3:15, saHT4:20,
  asLT13:75, saLT13:211, saLT4:0, asphalt:0, milling:0, hdd:0,
  poleSteel:15, poleWood:11, trPole1:10, trPole2:9, condMV:4300, abcLV:1200, riserRem:6, lbsRem:1,
  term3x400:33, lt300Term:10, lt185Term:8, lt70Term:16, joints:4, riser400:4},
 {name:"لوحة 4", rmu3w:2, rmu4w:3, rmuEx:0, tr220:2, tr400:2, trIndoor:2, trEx:0, pillars:3,
  htCable:4500, htEarth:24, mvSingle:36, lt300:252, lt185:16, lt70:23,
  asHT1:602, saHT1:3241, asHT2:120, saHT2:49, asHT3:0, saHT3:5, saHT4:0,
  asLT13:109, saLT13:35, saLT4:6, asphalt:294, milling:1038, hdd:305,
  poleSteel:15, poleWood:11, trPole1:10, trPole2:9, condMV:4500, abcLV:1200, riserRem:6, lbsRem:0,
  term3x400:22, lt300Term:11, lt185Term:16, lt70Term:24, joints:4, riser400:4}
];

export const SHEET_FIELDS: SheetFieldGroup[] = [
 {g:"معدات ج.متوسط", gEn:"MV equipment", f:[
   ["rmu3w","RMU 3 مسارات","RMU 3-way"],["rmu4w","RMU 4 مسارات","RMU 4-way"],["rmuEx","RMU قائمة","Existing RMU"],
   ["tr220","محطة وحدة 500/220","Unit sub 500/220"],["tr400","محطة وحدة 500/400","Unit sub 500/400"],
   ["trIndoor","محطة وحدة داخلية","Indoor unit sub"],["trEx","محطة وحدة قائمة","Existing unit sub"],["pillars","لوحة توزيع فرعية","LV pillar"]]},
 {g:"أطوال الكابلات (م)", gEn:"Cable lengths (m)", f:[
   ["htCable","كابل 3×400 ج.متوسط","MV 3×400"],["htEarth","نحاس تأريض 70مم²","Cu earth 70mm²"],
   ["mvSingle","كابل أحادي 1×50","MV single 1×50"],["lt300","كابل 4×300","LV 4×300"],
   ["lt185","كابل 4×185","LV 4×185"],["lt70","كابل 4×70","LV 4×70"]]},
 {g:"الحفريات (م.طولي)", gEn:"Excavation (linear m)", f:[
   ["asHT1","مسفلت – 1 كابل م.ض","Asphalt – 1 MV"],["saHT1","رملي – 1 كابل م.ض","Sandy – 1 MV"],
   ["asHT2","مسفلت – 2 كابل م.ض","Asphalt – 2 MV"],["saHT2","رملي – 2 كابل م.ض","Sandy – 2 MV"],
   ["asHT3","مسفلت – 3 كابل م.ض","Asphalt – 3 MV"],["saHT3","رملي – 3 كابل م.ض","Sandy – 3 MV"],
   ["saHT4","رملي – 4 كابل م.ض","Sandy – 4 MV"],["asLT13","مسفلت – 1:3 كابل م.خ","Asphalt – 1:3 LV"],
   ["saLT13","رملي – 1:3 كابل م.خ","Sandy – 1:3 LV"],["saLT4","رملي – 4 كابل م.خ","Sandy – 4 LV"]]},
 {g:"سفلتة وثقب أفقي", gEn:"Asphalt & HDD", f:[
   ["asphalt","إعادة سفلتة (م²)","Asphalt reinstate (m²)"],["milling","كشط وإعادة سفلتة (م²)","Milling (m²)"],
   ["hdd","ثقب أفقي (م)","HDD (m)"]]},
 {g:"نهايات ووصلات", gEn:"Terminations & joints", f:[
   ["term3x400","نهاية 3×400 (داخلي+خارجي)","MV term 3×400"],["joints","وصلة مستقيمة 3×400","MV straight joint"],
   ["lt300Term","نهاية 4×300","LV term 4×300"],["lt185Term","نهاية 4×185","LV term 4×185"],
   ["lt70Term","نهاية 4×70","LV term 4×70"],["riser400","كابل صاعد 3×400","Riser 3×400"]]},
 {g:"إزالة الشبكة الهوائية", gEn:"Overhead removals", f:[
   ["poleSteel","عمود حديدي","Steel pole"],["poleWood","عمود خشبي","Wooden pole"],
   ["trPole1","محول على عمود","TR on 1 pole"],["trPole2","محول على عمودين","TR on 2 poles"],
   ["condMV","موصلات م.ض (م)","MV conductor (m)"],["abcLV","أسلاك معزولة م.خ (م)","LV ABC (m)"],
   ["riserRem","كابل صاعد","Riser cable"],["lbsRem","مفتاح فصل","LBS"]]}
];

export const BASE_BOQ: Record<string, { plan: number; exec: number }> = {
 "301010101":{plan:1000, exec:372},  "301010102":{plan:0, exec:9},     "301010103":{plan:0, exec:210},
 "301010201":{plan:16000,exec:12546},"301010202":{plan:0, exec:680},   "301010203":{plan:0, exec:72},
 "301010204":{plan:0, exec:25},      "301010205":{plan:1000,exec:1547},"301010206":{plan:0, exec:120},
 "301010308":{plan:0, exec:23.5},    "302010002":{plan:0, exec:326},   "302020001":{plan:250, exec:305},
 "505020002":{plan:0, exec:14.4},    "304010101":{plan:750, exec:83},  "304010102":{plan:2500,exec:1467},
 "304010202":{plan:18000,exec:17430},"304010203":{plan:144, exec:240}, "304040201":{plan:0, exec:170},
 "305010301":{plan:40, exec:0},      "305010302":{plan:30, exec:29},   "305010102":{plan:0, exec:1},
 "305010401":{plan:0, exec:9},       "305020104":{plan:22, exec:17},   "305020404":{plan:0, exec:102},
 "305020407":{plan:90, exec:60},     "306010002":{plan:1000,exec:750}, "306010004":{plan:1000,exec:1228},
 "308020101":{plan:18, exec:27},     "308020105":{plan:6, exec:10},    "401000015":{plan:0, exec:65},
 "309010102":{plan:10, exec:9},      "309020101":{plan:29, exec:27},   "309020203":{plan:6, exec:10},
 "310010001":{plan:10, exec:9},      "310020001":{plan:11, exec:37},   "207000006":{plan:0, exec:15},
 "604000002":{plan:108, exec:148},   "205010302":{plan:0, exec:5},     "201010103":{plan:0, exec:3},
 "202010203":{plan:0, exec:8},       "201040003":{plan:60, exec:118},  "201040006":{plan:45, exec:84},
 "204010301":{plan:5000,exec:200},   "204020301":{plan:18000,exec:20000},"205040101":{plan:40, exec:1},
 "205040102":{plan:35, exec:6},      "205040206":{plan:2, exec:0},     "304040205":{plan:25, exec:36},
 "307010002":{plan:0, exec:20},      "307010005":{plan:0, exec:20},    "307040002":{plan:0, exec:1},
 "311000016":{plan:0, exec:47}
};

export const BASE_MAT: Record<string, { iss: number; req: number }> = {
 "8114005":{iss:18000, req:22000}, "8111007":{iss:2500, req:7000}, "8111006":{iss:250, req:250},
 "8111005":{iss:0, req:453},       "8113009":{iss:144, req:144},   "8327004":{iss:7, req:14},
 "8327005":{iss:11, req:14},       "8567054":{iss:2, req:8},       "8569108":{iss:4, req:4},
 "8569116":{iss:0, req:1},         "8121179":{iss:22, req:27},     "8121182":{iss:18, req:18},
 "8121139":{iss:36, req:36},       "8121008":{iss:20, req:20},     "8121009":{iss:20, req:20},
 "8121010":{iss:30, req:30},       "8111102":{iss:275, req:275},   "8111101":{iss:100, req:100},
 "8202054":{iss:64, req:64},       "8202189":{iss:55, req:55},     "8202098":{iss:20, req:20},
 "8202030":{iss:20, req:20},       "8122034":{iss:44, req:44}
};

export type RmuRowTuple = [number, string, string, string, string, string, string, boolean, string, string, string];
export const RMU_ROWS: RmuRowTuple[] = [
 // no, feeder, rmu, type, tr, relayMfr, relayModel, setting, ratio, earthOhm, coords
 [1,"NER 409","R101552","4W","","ASHIDA","SEL TPR6HP",false,"","3.1","17.693713,44.459428"],
 [2,"NER 409","R101553","4W","","ASHIDA","SEL TPR6HP",false,"","2.9","17.693713,44.459428"],
 [3,"NER 409","R101554","3W","","FANOX","FANAR SFA-RM",false,"","3.2","17.697286,44.456931"],
 [4,"NER 409","R101555","3W","TR1","FANOX","LUCY AEGIS",true,"500/400","3.0","17.698596,44.455705"],
 [5,"NER 409","R101556","4W","TR1","FANOX","LUCY AEGIS",true,"500/220","3.2","17.700701,44.453633"],
 [6,"NER 409","R101557","4W","TR1","FANOX","LUCY AEGIS",true,"500/400","2.4","17.702528,44.452034"],
 [7,"NER 409","R101558","4W","","FANOX","LUCY AEGIS",false,"","3.1","17.706196,44.448513"],
 [8,"NER 409","R101559","3W","","FANOX","FANAR SFA-RM",false,"","3.0","17.711855,44.445018"],
 [9,"NER 409","R101560","3W","","FANOX","FANAR SFA-RM",false,"","4.0","17.714299,44.443898"],
 [10,"NER 409","R101561","4W","","FANOX","LUCY AEGIS",false,"","3.1","17.718194,44.443038"],
 [11,"NER 409","R101562","3W","","FANOX","LUCY AEGIS",false,"","2.9","17.721830,44.442719"],
 [12,"NER 409","R101563","4W","","FANOX","LUCY AEGIS",false,"","3.1","17.724473,44.442670"],
 [13,"NER 409","R101564","3W","TR1","FANOX","LUCY AEGIS",true,"500/220","3.2","17.726636,44.442853"],
 [14,"NER 409","R101565","3W","TR1","ASHIDA","LUCY AEGIS",true,"500/400","3.2","17.730181,44.443141"],
 [15,"NER 409","R101566","4W","","FANOX","LUCY AEGIS",false,"","3.3","17.741221,44.443979"],
 [16,"NER 409","R101567","3W","TR1","FANOX","LUCY AEGIS",true,"500/220","2.8","17.745368,44.444331"],
 [17,"NER 409","R101568","4W","TR1","ZIV","FANAR SFA-RM",true,"500/400","2.1","17.746896,44.444526"],
 [18,"NER 409","R101569","3W","","FANOX","FANAR SFA-RM",false,"","3.0","17.749545,44.444759"],
 [19,"NER 409","R101570","4W","TR1+TR2","FANOX","LUCY AEGIS",true,"500/220 + 500/400","4.0","17.753580,44.444971"],
 [20,"NER 409","R101571","4W","","ASHIDA","SEL TPR6HP",false,"","3.0","17.755810,44.446920"],
 [21,"NER 419","R101572","4W","TR1","FANOX","FANAR SFA-RM",true,"500/220","3.1","17.694419,44.458481"],
 [22,"NER 419","R101573","3W","","ZIV","FANAR SFA-RM",false,"","2.9","17.696590,44.456515"],
 [23,"NER 419","R101574","4W","TR1","FANOX","LUCY AEGIS",true,"500/220","3.1","17.701783,44.451988"],
 [24,"NER 419","R101575","3W","","FANOX","LUCY AEGIS",false,"","3.2","17.720123,44.441431"],
 [25,"NER 419","R101576","4W","","ASHIDA","SEL TPR6HP",false,"","3.2","17.724575,44.442131"],
 [26,"NER 419","R101577","4W","TR1","FANOX","LUCY AEGIS",true,"500/400","3.2","17.726861,44.442361"],
 [27,"NER 419","R101578","4W","","ZIV","FANAR SFA-RM",false,"","3.3","17.754460,44.447530"],
 [28,"NER 419","R101579","3W","","FANOX","LUCY AEGIS",false,"","3.5","17.740616,44.443448"],
 [29,"NER 419","R101580","3W","","FANOX","FANAR SFA-RM",false,"","2.1","17.760568,44.444804"]
];

export const ACCEPT_COLS: [string, string, string][] = [
 ["body","جسم المعدة","Equipment body"],["gas","ضغط غاز SF6","SF6 gas level"],["clean","النظافة","Cleaning"],
 ["numbering","الترقيم","Numbering"],["found","ارتفاع القاعدة","Foundation height"],["phase","تتابع الأوجه","Phase sequence"],
 ["cableT","نهايات الكابلات","Cable terminations"],["door","الأبواب","Doors"],["handle","المقابض","Handles"],
 ["copen","فتحة التشغيل","C. open"],["barrier","أعمدة الحماية","Post barrier"]
];

export const AUTHORITY: AuthorityStep[] = [
 {max:10, ar:"مدير إدارة كهرباء نجران", en:"Najran Electricity Dept. Manager"},
 {max:20, ar:"مدير إدارة هندسة التوزيع", en:"Distribution Engineering Manager"},
 {max:30, ar:"نائب رئيس وحدة أعمال التوزيع وخدمات المشتركين – الجنوبية", en:"VP Distribution & Customer Services – South"},
 {max:1e9, ar:"نائب الرئيس التنفيذي للتوزيع وخدمات المشتركين (+ تقرير فني)", en:"EVP Distribution & Customer Services (+ technical report)"}
];
