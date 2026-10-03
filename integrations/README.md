# التكاملات — محفظة الالتزام

كل شيء هنا يعمل عبر الـ API نفسه (`/api/v1`، الوثائق التفاعلية على `/api/docs`، مواصفة OpenAPI 3.1 على `/api/docs/json`).
لا تكامل يتجاوز الصلاحيات: مفتاح API محدود بنطاقات (scopes)، وكل webhook موقّع.

## 1) مفاتيح API

يُنشئها مدير النظام من صفحة «المستخدمون والصلاحيات» ← «مفاتيح API وWebhooks» (أو `POST /api/v1/api-keys`).
تظهر قيمة المفتاح **مرة واحدة** فقط؛ يحفظ الخادم تجزئتها فقط.

| النطاق | يسمح بـ |
|---|---|
| `read:projects` | قراءة المشاريع (`GET /projects`, `GET /projects/:id`) وتصدير الملفات (`GET /projects/:id/export/:kind`) |
| `write:imports` | استيراد ملفات إلى مشروع (`POST /hooks/import`) |
| `send:reports` | إرسال التقارير بالبريد (`POST /reports/:key/send`) ومتابعة المهمة (`GET /reports/jobs/:id`) |

الاستخدام: ترويسة `X-API-Key: ilt_…`.

```bash
curl -X POST "$URL/api/v1/reports/dash/send" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"workOrderId":"<معرّف المشروع>","lang":"ar","attachPdf":true,"attachXlsx":true}'
# → 202 {"jobId":"…"}   ثم   GET /api/v1/reports/jobs/<jobId>
```

مدير النظام (`ADMIN_EMAIL`) مستلم إلزامي لكل تقرير يُرسل بأي وسيلة، بما فيها المفاتيح والجداول.

## 2) Webhooks الصادرة

تسجيلها من الصفحة نفسها أو `POST /api/v1/webhooks {url, events}`، ويعيد الخادم **السر** مرة واحدة.

الأحداث: `project.created`, `import.completed`, `takeoff.derived`, `report.sent`, `report.failed`, `invoice.generated`, `variance.exceeded_30pct`.

كل تسليم `POST` بجسم JSON وترويسات:

- `X-Signature: sha256=<HMAC-SHA256(secret, rawBody) hex>`
- `X-Event`: اسم الحدث · `X-Delivery`: معرّف التسليم

التحقق (Node):

```js
import { createHmac, timingSafeEqual } from "node:crypto";
const ok = (secret, rawBody, header) => {
  const mine = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex"));
  const got = Buffer.from(header || "");
  return mine.length === got.length && timingSafeEqual(mine, got);
};
```

يعاد التسليم تلقائيًا عند الفشل، وسجل المحاولات في `GET /api/v1/webhooks/:id/deliveries`، واختبار فوري `POST /api/v1/webhooks/:id/test`.

## 3) Webhook وارد: استيراد ملف

`POST /api/v1/hooks/import?wo=<رقم أمر العمل>` (أو `workOrderId=<uuid>`)، جسم `multipart/form-data` فيه الملف.
المصادقة: `X-API-Key` بنطاق `write:imports`، أو `X-Webhook-Secret: $WEBHOOK_SECRET`.
يمرّ الملف على **نفس محرك الاستيراد** (مطابقة هوية أمر العمل، منع خلط المشاريع، تنبيه تعارض الإحداثيات).

## 4) n8n

استورد الملفين من `integrations/n8n/` (Workflows ← Import from file) وأنشئ بيانات اعتماد من نوع **Header Auth**
باسم `Iltizam API key (X-API-Key)` واسم الترويسة `X-API-Key` وقيمتها المفتاح، ثم عيّن المتغير `ILTIZAM_URL`.

- `weekly-dash-report.json`: **كل أحد 8 صباحًا** يجلب المشاريع ثم يرسل `POST /reports/dash/send` لكل مشروع.
- `import-file-webhook.json`: يستقبل ملفًا من أي نظام (Webhook في n8n) ويمرّره إلى `/hooks/import`.

بديل داخلي بلا n8n: جدولة التقارير من صفحة «قوائم البريد» (أسبوعيًا/شهريًا)، ينفذها عامل داخل الخادم.

## 5) نقاط الامتداد

| الواجهة | الموقع | الغرض |
|---|---|---|
| `ErpAdapter` | `apps/api/src/services/erp.ts` | `fetchMaterialMovements` (حركة مواد SAP) و`pushInvoice` — التنفيذ الحالي وهمي |
| `StorageProvider` | `apps/api/src/services/storage.ts` | `local` (افتراضي) أو `s3` (`STORAGE_PROVIDER=s3`) لأصول الملفات والمرفقات الكبيرة |
| `MailProvider` | `apps/api/src/services/mail/index.ts` | `smtp` (افتراضي) أو `resend` أو `gmail_api` عبر `MAIL_PROVIDER` |

---
Project manager · Eng. Ahmed Zahran
