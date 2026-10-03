import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import type { Config } from "../../config";
import type { MailMessage, MailProvider, SendResult } from "../types";

const norm = (m: MailMessage) => ({ ...m, to: [...new Set(m.to.map((x) => x.trim()).filter(Boolean))] });

/** SMTP عبر nodemailer — الافتراضي (يعمل مع MailHog وGmail SMTP وغيرهما) */
export class SmtpProvider implements MailProvider {
  readonly name = "smtp";
  private t: nodemailer.Transporter | null = null;
  constructor(private cfg: Config) {}
  private tr() {
    if (!this.t) this.t = nodemailer.createTransport({
      host: this.cfg.SMTP_HOST, port: this.cfg.SMTP_PORT, secure: this.cfg.SMTP_SECURE || this.cfg.SMTP_PORT === 465,
      ...(this.cfg.SMTP_USER ? { auth: { user: this.cfg.SMTP_USER, pass: this.cfg.SMTP_PASS } } : {}),
      ignoreTLS: !this.cfg.SMTP_USER && this.cfg.SMTP_PORT !== 465 && this.cfg.SMTP_PORT !== 587, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000,
    });
    return this.t;
  }
  async send(msg: MailMessage): Promise<SendResult> {
    if (!this.cfg.SMTP_HOST) return { ok: false, error: "SMTP_HOST غير مضبوط" };
    const m = norm(msg);
    try {
      const r = await this.tr().sendMail({ from: m.from ?? this.cfg.MAIL_FROM, to: m.to, subject: m.subject, html: m.html, text: m.text,
        attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) });
      const rejected = (r.rejected ?? []) as string[];
      if (rejected.length && rejected.length >= m.to.length) return { ok: false, error: "رفض الخادم كل المستلمين: " + rejected.join(", ") };
      return { ok: true, messageId: r.messageId };
    } catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 400) }; }
  }
  async health() {
    if (!this.cfg.SMTP_HOST) return { ok: false, provider: "smtp", detail: "SMTP_HOST غير مضبوط" };
    try { await this.tr().verify(); return { ok: true, provider: "smtp", detail: `${this.cfg.SMTP_HOST}:${this.cfg.SMTP_PORT}` }; }
    catch (e: any) { return { ok: false, provider: "smtp", detail: String(e?.message ?? e).slice(0, 200) }; }
  }
}

/** Resend (HTTPS API) */
export class ResendProvider implements MailProvider {
  readonly name = "resend";
  constructor(private cfg: Config) {}
  async send(msg: MailMessage): Promise<SendResult> {
    if (!this.cfg.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY غير مضبوط" };
    const m = norm(msg);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${this.cfg.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: m.from ?? this.cfg.MAIL_FROM, to: m.to, subject: m.subject, html: m.html, text: m.text,
          attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }),
      });
      const j: any = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, messageId: j.id } : { ok: false, error: `Resend ${r.status}: ${j.message ?? JSON.stringify(j)}`.slice(0, 400) };
    } catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 400) }; }
  }
  async health() {
    if (!this.cfg.RESEND_API_KEY) return { ok: false, provider: "resend", detail: "RESEND_API_KEY غير مضبوط" };
    try { const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${this.cfg.RESEND_API_KEY}` } }); return { ok: r.status < 500 && r.status !== 401, provider: "resend", detail: `HTTP ${r.status}` }; }
    catch (e: any) { return { ok: false, provider: "resend", detail: String(e?.message ?? e).slice(0, 200) }; }
  }
}

/** Gmail API (OAuth2 refresh token) — يبني MIME ويرسله عبر users.messages.send */
export class GmailApiProvider implements MailProvider {
  readonly name = "gmail_api";
  private tok: { v: string; exp: number } | null = null;
  constructor(private cfg: Config) {}
  private async token(): Promise<string> {
    if (this.tok && this.tok.exp > Date.now() + 30000) return this.tok.v;
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.cfg.GMAIL_CLIENT_ID, client_secret: this.cfg.GMAIL_CLIENT_SECRET, refresh_token: this.cfg.GMAIL_REFRESH_TOKEN, grant_type: "refresh_token" }),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(`OAuth ${r.status}: ${j.error_description ?? j.error}`);
    this.tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3000) * 1000 };
    return this.tok.v;
  }
  async send(msg: MailMessage): Promise<SendResult> {
    if (!this.cfg.GMAIL_REFRESH_TOKEN) return { ok: false, error: "إعدادات Gmail API غير مكتملة" };
    const m = norm(msg);
    try {
      const mime: Buffer = await new Promise((res, rej) => new (MailComposer as any)({ from: m.from ?? this.cfg.GMAIL_SENDER ?? this.cfg.MAIL_FROM, to: m.to, subject: m.subject, html: m.html, text: m.text,
        attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }).compile().build((e: Error | null, b: Buffer) => (e ? rej(e) : res(b))));
      const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST", headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: mime.toString("base64url") }),
      });
      const j: any = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, messageId: j.id } : { ok: false, error: `Gmail ${r.status}: ${j.error?.message ?? ""}`.slice(0, 400) };
    } catch (e: any) { return { ok: false, error: String(e?.message ?? e).slice(0, 400) }; }
  }
  async health() {
    if (!this.cfg.GMAIL_REFRESH_TOKEN) return { ok: false, provider: "gmail_api", detail: "إعدادات Gmail API غير مكتملة" };
    try { await this.token(); return { ok: true, provider: "gmail_api", detail: "OAuth ✓" }; }
    catch (e: any) { return { ok: false, provider: "gmail_api", detail: String(e?.message ?? e).slice(0, 200) }; }
  }
}

export function createMailProvider(cfg: Config): MailProvider {
  if (cfg.MAIL_PROVIDER === "resend") return new ResendProvider(cfg);
  if (cfg.MAIL_PROVIDER === "gmail_api") return new GmailApiProvider(cfg);
  return new SmtpProvider(cfg);
}
