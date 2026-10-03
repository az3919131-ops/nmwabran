// خادم SMTP وهمي للاختبار: يلتقط الرسائل (مثل MailHog) ويحلّلها في الذاكرة.
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

export async function startSmtpSink(port = 2525) {
  const messages = [];
  const server = new SMTPServer({
    authOptional: true, disabledCommands: ["STARTTLS"], logger: false,
    onData(stream, session, cb) {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", async () => {
        try {
          const raw = Buffer.concat(chunks);
          const m = await simpleParser(raw);
          messages.push({
            to: session.envelope.rcptTo.map((r) => r.address.toLowerCase()), from: session.envelope.mailFrom && session.envelope.mailFrom.address,
            subject: m.subject ?? "", html: m.html || "", text: m.text || "",
            attachments: (m.attachments || []).map((a) => ({ filename: a.filename, contentType: a.contentType, size: a.size, content: a.content })),
          });
          cb();
        } catch (e) { cb(e); }
      });
    },
  });
  await new Promise((res, rej) => { server.once("error", rej); server.listen(port, "127.0.0.1", res); });
  return {
    port, messages,
    to: (email) => messages.filter((m) => m.to.includes(email.toLowerCase())),
    clear: () => { messages.length = 0; },
    close: () => new Promise((res) => server.close(() => res())),
  };
}
