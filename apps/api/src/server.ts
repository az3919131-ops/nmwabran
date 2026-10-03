import { buildApp } from "./app";
import { loadConfig } from "./config";
import { buildContext } from "./context";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { seedAll } from "./db/seed";
import { allRoutes } from "./routes";

async function main() {
  const cfg = loadConfig();
  const h = createDb(cfg.DATABASE_URL);
  await runMigrations(h.db);
  const log = { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) };
  await seedAll(h.db, cfg, log);
  const ctx = await buildContext(cfg, h);
  const app = await buildApp({ ctx, logger: true, routes: allRoutes });
  await app.listen({ port: cfg.PORT, host: cfg.HOST });
  app.log.info(`المنصة جاهزة: http://localhost:${cfg.PORT} · الوثائق: /api/docs · البريد: ${ctx.mail.name} · المدير: ${cfg.ADMIN_EMAIL}`);
  const stop = async () => { await app.close(); await ctx.queue.stop(); await ctx.pdf?.close(); await h.close(); process.exit(0); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
main().catch((e) => { console.error(e); process.exit(1); });
