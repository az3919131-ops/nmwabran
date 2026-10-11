# موقع أحمد زهران + لوحة التحكم (واتساب ↔ n8n)

صفحة تعريفية تنفيذية ثنائية اللغة (عربي RTL افتراضيًا / English LTR) مع لوحة تحكم مرتبطة بـ n8n للرد الآلي على واتساب.
**React 19 + TypeScript + Vite + Tailwind CSS 4 + `motion/react` + `lucide-react`.** لا خادم خاص به: n8n هو الخلفية.

> يظهر التوقيع **Project manager · Eng. Ahmed Zahran** أسفل كل صفحة (الرئيسية، لوحة التحكم، شاشة الاتصال، 404)،
> وتنتهي به قوالب الرد الآلي الجاهزة وملاحظة بطاقة جهة الاتصال.

## التشغيل

```bash
npm install                 # من جذر المستودع
npm run dev:portfolio       # http://localhost:5180
npm run build -w @nmwabran/portfolio   # الناتج في apps/portfolio/dist (ملفات ثابتة تُنشر على أي استضافة)
npm run test -w @nmwabran/portfolio    # اختبارات الوحدات
npm run typecheck -w @nmwabran/portfolio
```

التوجيه بالـ hash، فلا يحتاج الخادم أي إعداد: الصفحة الرئيسية على `/#/` ولوحة التحكم على `/#/dashboard`.

## الإعداد

انسخ `.env.example` إلى `.env.local` (كلها اختيارية):

| المتغير | الوظيفة |
|---|---|
| `VITE_WHATSAPP_NUMBER` | رقم واتساب الدولي بلا `+` (الافتراضي `966565324387`) |
| `VITE_N8N_BASE_URL` | عنوان خادم n8n؛ منه تُشتق روابط المراجعة والنموذج ولوحة التحكم (الافتراضي المدمج: خادمك الحالي؛ القيمة الفارغة تعطّله) |
| `VITE_N8N_WEBHOOK_ID` | معرّف webhook/نموذج «مراجعة الصفحة والتعليقات» (`0818531a-…`) |
| `VITE_N8N_DASHBOARD_PATH` | مسار webhook لوحة التحكم (الافتراضي `ahmed-dashboard`) |
| `VITE_SITE_URL` | عنوان الموقع العام لملء حقل «رابط الصفحة» |

> متغيرات `VITE_*` تُدمج في الملفات العامة؛ لا تضع فيها أسرارًا. مفتاح لوحة التحكم يُدخل في المتصفح فقط.

## النشر

الناتج ملفات ثابتة (`apps/portfolio/dist`) تُنشر على أي استضافة، ويتضمن `_headers` (ترويسات أمان وتخزين مؤقت للأصول) يفهمه Netlify.

```bash
npm run build -w @nmwabran/portfolio
npx netlify-cli deploy --prod --dir apps/portfolio/dist     # أو اسحب المجلد إلى https://app.netlify.com/drop
```

بعد النشر افتح `/#/dashboard` وأدخل مفتاحك؛ رابط الـ webhook معبّأ تلقائيًا من خادم n8n الافتراضي.

## تعديل المحتوى

كل النصوص الشخصية في ملف واحد: **`src/data/profile.ts`** (عربي + إنجليزي). نصوص الواجهة في `src/i18n/strings.ts`
ونصوص اللوحة في `src/dashboard/strings.ts`. اختبار `test/i18n.test.ts` يفشل إن نقصت أي ترجمة.

بنود عليها علامة `VERIFY` في `profile.ts` وردت في الطلب ولا تؤيدها السيرة الذاتية؛ راجعها قبل النشر:
أرقام الشريط (`120+` مشروعًا، `$50M+`، `99.8%`)، والموقع، وإملاء أسماء المحطات بالعربية.
شهادة **PMP** معروضة «قيد الإعداد» كما في السيرة؛ غيّر `status` إلى `"earned"` عند الحصول عليها.

## قسم التواصل (تبويبان)

1. **رسالة واتساب:** اسم + رسالة ← يفتح `https://api.whatsapp.com/send?phone=…&text=…`.
2. **مراجعة ذكية عبر n8n:** يرسل `POST` JSON إلى webhook (`/webhook/<VITE_N8N_WEBHOOK_ID>`):

   ```json
   { "landingPageUrl": "https://…", "name": "…", "comments": "…", "lang": "ar",
     "source": "ahmed-zahran-portfolio", "submittedAt": "…", "requestId": "uuid" }
   ```

   - زر **فتح نموذج n8n المباشر** يفتح `/form/<المعرّف>`، وزر ⚙️ يضبط عنوان الخادم أو الروابط (يُحفظ في `localStorage`).
   - إن منع المتصفح قراءة الرد (CORS) يُعاد الإرسال تلقائيًا بصيغة `x-www-form-urlencoded` ويُعرض «أُرسل لكن غير مؤكد»،
     والـ `requestId` نفسه في المحاولتين ليتجاهل n8n التكرار. لإظهار نتيجة الإرسال فعّل **Allowed Origins (CORS)** في عقدة Webhook.

## لوحة التحكم `/#/dashboard`

أربعة تبويبات: **نظرة عامة** (ردود اليوم، آخر 7 أيام، الإجمالي، الجهات، حالة الرد الآلي، رسم 14 يومًا مع عرض جدولي)،
**رسالة الرد** (تحرير النص، `{name}` و`{date}`، قوالب، معاينة بشكل واتساب، تفعيل/إيقاف)، **سجل الردود** (بحث وفترة وفتح محادثة)،
**الربط مع n8n**. زر «جرّب بيانات تجريبية» يعرض كل شيء ببيانات وهمية دون أي اتصال.

الاتصال: `POST {webhook}` بترويسة `x-dashboard-key` وجسم `{"action":"overview"}` أو `{"action":"save_message","message":"…","enabled":"نعم|لا"}`.
المفتاح يبقى في `sessionStorage` ولا يُحفظ على الجهاز إلا بتفعيل «تذكّرني».

### إعداد n8n (مرة واحدة)

1. **انشر** workflow «واجهة لوحة التحكم – أحمد» (موجود في حسابك، ونسخته في `integrations/n8n/dashboard-api.json`).
2. افتح جدول البيانات **`dashboard_config`** واستبدل `CHANGE_ME` في صف `api_key` بمفتاحك السري (نص طويل عشوائي). ما دام `CHANGE_ME` فكل الطلبات تُرفض.
3. اربط بيانات اعتماد **WhatsApp Business Cloud** (Meta) في workflow «واتساب – الرد الآلي برسالة اليوم» ثم انشره.
4. افتح `/#/dashboard`، أدخل رابط الـ webhook والمفتاح، واضغط «اتصل».

الـ workflow يقرأ ويكتب في الجدولين الموجودين أصلًا: `wa_daily_message` (رسالة اليوم) و`wa_reply_log` (سجل الردود)،
فلا يتغير شيء في workflow الرد الآلي نفسه.

## البنية

```
src/config.ts            الإعدادات العامة والتوقيع
src/data/profile.ts      المحتوى الشخصي ثنائي اللغة
src/i18n/                سياق اللغة (dir/lang تلقائيًا) ونصوص الواجهة
src/landing/             الصفحة الرئيسية (Header, Hero, About, Experience, Projects, Certifications, Contact, Footer)
src/dashboard/           لوحة التحكم (تبويبات، رسم، محرر الرسالة، السجل، الربط) + بيانات تجريبية
src/lib/                 vCard، واتساب، عميل n8n، عميل اللوحة، إحصاءات، تنسيق
test/                    اختبارات vitest
```

---
Project manager · Eng. Ahmed Zahran
