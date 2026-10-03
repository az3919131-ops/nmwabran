import { z } from "zod";

const bool = z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgresql://iltizam:iltizam@127.0.0.1:5432/iltizam"),
  JWT_SECRET: z.string().min(8).default("change-me"),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  /** رابط الخادم نفسه كما يراه Chromium عند توليد PDF (يخدم الواجهة المبنية) */
  PDF_RENDER_BASE_URL: z.string().optional(),
  PUBLIC_API_URL: z.string().optional(),
  COOKIE_SECURE: bool.default(false),
  CORS_ORIGINS: z.string().optional(),

  MAIL_PROVIDER: z.enum(["smtp", "resend", "gmail_api"]).default("smtp"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_SECURE: bool.default(false),
  MAIL_FROM: z.string().default("محفظة الالتزام <no-reply@example.com>"),
  RESEND_API_KEY: z.string().default(""),
  GMAIL_CLIENT_ID: z.string().default(""),
  GMAIL_CLIENT_SECRET: z.string().default(""),
  GMAIL_REFRESH_TOKEN: z.string().default(""),
  GMAIL_SENDER: z.string().default(""),

  ADMIN_EMAIL: z.string().email().default("az3919131@gmail.com"),
  REPORT_MAX_ATTACH_MB: z.coerce.number().default(15),
  WEBHOOK_SECRET: z.string().default("change-me"),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().default(""), S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default(""), S3_ACCESS_KEY: z.string().default(""), S3_SECRET_KEY: z.string().default(""),
  S3_FORCE_PATH_STYLE: bool.default(true),

  WEB_DIST_DIR: z.string().optional(),
  CHROMIUM_PATH: z.string().optional(),
  DISABLE_PDF: bool.default(false),

  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),

  /** كلمات المرور الأولية للمستخدمين الافتراضيين — غيّرها بعد أول دخول */
  SEED_ADMIN_USER: z.string().default("ahmed"),
  SEED_ADMIN_PASSWORD: z.string().default(""),
  SEED_DEPT_PASSWORD: z.string().default(""),
  SEED_PM_PASSWORD: z.string().default(""),
  SEED_DEMO_DATA: bool.default(true),

  QUEUE_ENABLED: bool.default(true),
  /** جداول pg-boss في مخطط منفصل */
  QUEUE_SCHEMA: z.string().default("pgboss"),
});
export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = schema.parse(env);
  if (c.NODE_ENV === "production" && (c.JWT_SECRET === "change-me" || c.WEBHOOK_SECRET === "change-me")) {
    throw new Error("JWT_SECRET و WEBHOOK_SECRET يجب تغييرهما في بيئة الإنتاج");
  }
  c.ADMIN_EMAIL = c.ADMIN_EMAIL.trim().toLowerCase();
  return c;
}
