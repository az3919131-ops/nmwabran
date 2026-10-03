import { loadConfig } from "../config";
import { createDb } from "./client";
import { runMigrations } from "./migrate";
import { seedAll } from "./seed";

const cfg = loadConfig();
const h = createDb(cfg.DATABASE_URL);
runMigrations(h.db).then(() => seedAll(h.db, cfg)).then(() => { console.log("✓ تم الزرع"); return h.close(); }).catch((e) => { console.error(e); process.exit(1); });
