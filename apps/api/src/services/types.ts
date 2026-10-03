export interface MailAttachment { filename: string; content: Buffer; contentType: string }
export interface MailMessage {
  to: string[]; subject: string; html: string; text?: string; attachments?: MailAttachment[];
  /** لو أُرسلت رسالة لكل مستلم على حدة نحدد From/Reply-To اختياريًا */
  from?: string;
}
export interface SendResult { ok: boolean; messageId?: string; error?: string }
export interface MailProvider {
  readonly name: string;
  send(msg: MailMessage): Promise<SendResult>;
  /** يختبر الاتصال بالمزوّد: SMTP verify / مفتاح API */
  health(): Promise<{ ok: boolean; provider: string; detail?: string }>;
}
export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
}
export interface JobQueue {
  /** يضيف مهمة إرسال تقرير؛ يعيد true إن قُبلت */
  enqueueReport(emailLogId: string): Promise<void>;
  enqueueWebhook(deliveryId: number): Promise<void>;
  syncSchedules(): Promise<void>;
  stop(): Promise<void>;
}
export interface AppEvents {
  emit(event: string, payload: Record<string, unknown>): void | Promise<void>;
}
export const WEBHOOK_EVENTS = [
  "project.created", "import.completed", "takeoff.derived", "report.sent", "report.failed", "invoice.generated", "variance.exceeded_30pct",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export const API_SCOPES = ["read:projects", "write:imports", "send:reports"] as const;
export type ApiScope = (typeof API_SCOPES)[number];
