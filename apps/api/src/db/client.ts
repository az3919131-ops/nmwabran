import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export interface DbHandle { db: DB; pool: pg.Pool; close(): Promise<void> }

export function createDb(url: string): DbHandle {
  const pool = new pg.Pool({ connectionString: url, max: 12 });
  pool.on("error", (e) => console.error("pg pool error:", e.message));
  // pg يُرجع numeric نصوصًا؛ نتركها كما هي ونحوّل في طبقة المستودع
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
export { schema };
