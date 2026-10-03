import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { loadConfig } from "../config";
import { createDb, type DB } from "./client";

export function migrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cands = [process.env.MIGRATIONS_DIR, path.resolve(here, "../../drizzle"), path.resolve(here, "../drizzle"), path.resolve(process.cwd(), "drizzle"), path.resolve(process.cwd(), "apps/api/drizzle")];
  const d = cands.find((x) => x && existsSync(path.join(x, "meta", "_journal.json")));
  if (!d) throw new Error("مجلد الهجرات غير موجود (drizzle/)");
  return d;
}
export async function runMigrations(db: DB): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsDir() });
}
// تشغيل مباشر: npm run db:migrate
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  const cfg = loadConfig();
  const h = createDb(cfg.DATABASE_URL);
  runMigrations(h.db).then(() => { console.log("✓ الهجرات مطبّقة"); return h.close(); }).catch((e) => { console.error(e); process.exit(1); });
}
