import { sql } from "drizzle-orm";
import {
  bigserial, boolean, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, check,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("user_role", ["admin", "dept", "pm"]);
export const emailStatusEnum = pgEnum("email_status", ["queued", "sent", "partial", "failed"]);

/* ───────── المستخدمون والصلاحيات ───────── */
export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("pm"),
  active: boolean("active").notNull().default(true),
  passwordHash: text("password_hash").notNull(),
  /** true = يرى كل المقاولين؛ false = يقتصر على user_contractors */
  allContractors: boolean("all_contractors").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [uniqueIndex("users_username_uq").on(t.username)]);

export const userPermissions = pgTable("user_permissions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  canView: boolean("view").notNull().default(false),
  canEdit: boolean("edit").notNull().default(false),
  canDel: boolean("del").notNull().default(false),
  canExp: boolean("exp").notNull().default(false),
}, (t) => [uniqueIndex("user_permissions_uq").on(t.userId, t.module)]);

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  /** قفل التعديل: الجلسة تبدأ مقفلة ويفتحها كلمة مرور مدير النظام */
  unlocked: boolean("unlocked").notNull().default(false),
  ip: text("ip"), userAgent: text("user_agent"),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId), uniqueIndex("sessions_token_uq").on(t.tokenHash)]);

export const passwordResets = pgTable("password_resets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  newHash: text("new_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  tries: integer("tries").notNull().default(0),
  /** sent | pending | done | expired | blocked | rejected */
  status: text("status").notNull().default("sent"),
  mailError: text("mail_error"),
  createdAt: createdAt(),
});

/* ───────── المقاولون والاستشاريون ───────── */
export const contractors = pgTable("contractors", {
  id: id(),
  name: text("name").notNull(),
  crNumber: text("cr_number"),
  contactName: text("contact_name"), contactPhone: text("contact_phone"), contactEmail: text("contact_email"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [uniqueIndex("contractors_name_uq").on(t.name)]);

export const userContractors = pgTable("user_contractors", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contractorId: uuid("contractor_id").notNull().references(() => contractors.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.contractorId] })]);

export const consultants = pgTable("consultants", {
  id: id(), name: text("name").notNull(), contact: text("contact"), email: text("email"), createdAt: createdAt(),
});

/* ───────── المشاريع (أوامر العمل) ───────── */
export const workOrders = pgTable("work_orders", {
  id: id(),
  woNumber: text("wo_number").notNull().default(""),
  name: text("name").notNull(),
  site: text("site").notNull().default(""),
  admin: text("admin").notNull().default("نجران"),
  sector: text("sector").notNull().default("الجنوبي"),
  contractorId: uuid("contractor_id").notNull().references(() => contractors.id),
  consultantId: uuid("consultant_id").references(() => consultants.id),
  approvedDate: text("approved_date").notNull().default(""),
  estMat: numeric("est_mat", { precision: 18, scale: 2 }).notNull().default("0"),
  estInst: numeric("est_inst", { precision: 18, scale: 2 }).notNull().default("0"),
  estInd: numeric("est_ind", { precision: 18, scale: 2 }).notNull().default("0"),
  /** null = لم يُشغَّل الاستنباط بعد */
  derivedAt: timestamp("derived_at", { withTimezone: true }),
  factors: jsonb("factors").notNull().default({}),
  notes: text("notes").notNull().default(""),
  invoice: jsonb("invoice"),
  prevTotal: numeric("prev_total", { precision: 18, scale: 2 }),
  accept: jsonb("accept").notNull().default({}),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("work_orders_wo_idx").on(t.woNumber), index("work_orders_contractor_idx").on(t.contractorId)]);

export const layoutSheets = pgTable("layout_sheets", {
  id: id(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull().default(0),
  name: text("name").notNull(),
  /** كل حقول الحصر (SHEET_FIELDS) */
  fields: jsonb("fields").notNull().default({}),
}, (t) => [index("layout_sheets_wo_idx").on(t.workOrderId)]);

export const workOrderLines = pgTable("work_order_lines", {
  id: id(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  plan: numeric("plan", { precision: 18, scale: 4 }).notNull().default("0"),
  exec: numeric("exec", { precision: 18, scale: 4 }).notNull().default("0"),
}, (t) => [uniqueIndex("work_order_lines_uq").on(t.workOrderId, t.code)]);

export const materialLines = pgTable("material_lines", {
  id: id(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  issued: numeric("issued", { precision: 18, scale: 4 }).notNull().default("0"),
  required: numeric("required", { precision: 18, scale: 4 }).notNull().default("0"),
}, (t) => [uniqueIndex("material_lines_uq").on(t.workOrderId, t.code)]);

export const catalogMaterials = pgTable("catalog_materials", {
  code: text("code").primaryKey(),
  ar: text("ar").notNull(), en: text("en").notNull(), unit: text("unit").notNull(),
  price: numeric("price", { precision: 18, scale: 4 }).notNull().default("0"),
  klass: text("klass").notNull().default("detail"), grp: text("grp").notNull().default("acc"),
  added: boolean("added").notNull().default(false),
  updatedAt: updatedAt(),
});
export const catalogWorks = pgTable("catalog_works", {
  code: text("code").primaryKey(),
  ar: text("ar").notNull(), en: text("en").notNull(), unit: text("unit").notNull(),
  price: numeric("price", { precision: 18, scale: 4 }).notNull().default("0"),
  grp: text("grp").notNull().default("inst"),
  added: boolean("added").notNull().default(false),
  updatedAt: updatedAt(),
});

export const rmuUnits = pgTable("rmu_units", {
  id: id(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  /** ترتيب الصف في الجدول */
  ord: integer("ord").notNull().default(0),
  /** رقم الوحدة المعروض (#) */
  seq: integer("seq").notNull().default(0),
  feeder: text("feeder").notNull().default(""),
  rmu: text("rmu").notNull(),
  type: text("type").notNull().default(""),
  tr: text("tr").notNull().default(""),
  relay: text("relay").notNull().default("—"),
  model: text("model").notNull().default("—"),
  setDone: boolean("set_done").notNull().default(false),
  ctRatio: text("ct_ratio").notNull().default(""),
  earthOhm: text("earth_ohm").notNull().default(""),
  gps: text("gps").notNull().default(""),
  gpsSrc: text("gps_src"),
  lat: numeric("lat", { precision: 10, scale: 6 }),
  lon: numeric("lon", { precision: 10, scale: 6 }),
}, (t) => [index("rmu_units_wo_idx").on(t.workOrderId)]);

export const geoPoints = pgTable("geo_points", {
  id: id(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  ord: integer("ord").notNull().default(0),
  pointId: text("point_id").notNull(),
  lat: numeric("lat", { precision: 10, scale: 6 }).notNull(),
  lon: numeric("lon", { precision: 10, scale: 6 }).notNull(),
  src: text("src").notNull().default(""),
  type: text("type").notNull().default("PT"),
}, (t) => [index("geo_points_wo_idx").on(t.workOrderId)]);

export const uploadedFiles = pgTable("uploaded_files", {
  id: id(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull().default(0),
  mime: text("mime").notNull().default(""),
  ext: text("ext").notNull().default(""),
  kind: text("kind").notNull().default("doc"),
  /** imported | blocked | reference | failed */
  status: text("status").notNull().default("reference"),
  rows: integer("rows").notNull().default(0),
  storageKey: text("storage_key"),
  ident: jsonb("ident"),
  woState: text("wo_state"),
  report: jsonb("report").notNull().default([]),
  geoN: integer("geo_n").notNull().default(0),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("uploaded_files_wo_idx").on(t.workOrderId)]);

export const importLog = pgTable("import_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  fileId: uuid("file_id"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  summary: text("summary").notNull().default(""),
  report: jsonb("report").notNull().default([]),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/** لقطة المشروع قبل كل استيراد — للتراجع عن آخر استيراد */
export const projectSnapshots = pgTable("project_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  label: text("label").notNull().default(""),
  data: jsonb("data").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("project_snapshots_wo_idx").on(t.workOrderId)]);

export const emergencyTickets = pgTable("emergency_tickets", {
  id: id(), ticketNo: text("ticket_no").notNull(), workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  title: text("title").notNull().default(""), status: text("status").notNull().default("open"),
  payload: jsonb("payload").notNull().default({}), createdAt: createdAt(),
});
export const targets = pgTable("targets", {
  id: id(), workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  period: text("period").notNull().default(""), metric: text("metric").notNull(), value: numeric("value", { precision: 18, scale: 4 }).notNull().default("0"),
  payload: jsonb("payload").notNull().default({}), createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id"),
  username: text("username").notNull().default("—"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  detail: text("detail").notNull().default(""),
  ip: text("ip"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_log_at_idx").on(t.at)]);

/* ───────── البريد وقوائم المستلمين ───────── */
export const emailRecipients = pgTable("email_recipients", {
  id: id(),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  roleLabel: text("role_label").notNull().default(""),
  active: boolean("active").notNull().default(true),
  /** مدير النظام: مستلم إلزامي لا يُحذف ولا يُعطَّل ولا يتغير بريده */
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("email_recipients_email_uq").on(t.email),
  check("email_recipients_lower", sql`${t.email} = lower(${t.email})`),
]);

/** مصفوفة نطاق: أي مستلم يتلقى أي تقرير (الغياب = مسموح؛ الصف allowed=false يستثني) */
export const recipientReportScope = pgTable("recipient_report_scope", {
  recipientId: uuid("recipient_id").notNull().references(() => emailRecipients.id, { onDelete: "cascade" }),
  reportKey: text("report_key").notNull(),
  allowed: boolean("allowed").notNull().default(true),
}, (t) => [primaryKey({ columns: [t.recipientId, t.reportKey] })]);

export const emailLog = pgTable("email_log", {
  id: id(),
  reportKey: text("report_key").notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
  recipients: jsonb("recipients").notNull().default([]),
  subject: text("subject").notNull().default(""),
  attachments: jsonb("attachments").notNull().default([]),
  status: emailStatusEnum("status").notNull().default("queued"),
  error: text("error"),
  /** معاملات الطلب لإعادة المحاولة */
  payload: jsonb("payload").notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("email_log_created_idx").on(t.createdAt), index("email_log_report_idx").on(t.reportKey)]);

export const reportSchedules = pgTable("report_schedules", {
  id: id(),
  reportKey: text("report_key").notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
  cron: text("cron").notNull(),
  active: boolean("active").notNull().default(true),
  lang: text("lang").notNull().default("ar"),
  attachPdf: boolean("attach_pdf").notNull().default(true),
  attachXlsx: boolean("attach_xlsx").notNull().default(true),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ───────── التكاملات ───────── */
export const apiKeys = pgTable("api_keys", {
  id: id(), name: text("name").notNull(),
  keyHash: text("key_hash").notNull(), prefix: text("prefix").notNull(),
  scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash)]);

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: id(), url: text("url").notNull(), secret: text("secret").notNull(),
  events: text("events").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  endpointId: uuid("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  event: text("event").notNull(), payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  responseCode: integer("response_code"), error: text("error"),
  createdAt: createdAt(), deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});
