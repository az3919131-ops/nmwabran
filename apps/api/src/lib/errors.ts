/** أخطاء API برسائل عربية واضحة */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) { super(message); }
}
export const badRequest = (m: string, code = "bad_request", extra?: Record<string, unknown>) => new HttpError(400, m, code, extra);
export const unauthorized = (m = "يلزم تسجيل الدخول") => new HttpError(401, m, "unauthorized");
export const forbidden = (m = "لا تملك صلاحية لهذا الإجراء", code = "forbidden") => new HttpError(403, m, code);
export const notFound = (m = "غير موجود") => new HttpError(404, m, "not_found");
export const conflict = (m: string, code = "conflict") => new HttpError(409, m, code);
export const locked = () => new HttpError(423, "التعديل مقفل — افتح القفل بكلمة مرور مدير النظام أولًا", "edit_locked");
