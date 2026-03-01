import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";

const pool = new Pool({
  connectionString: env.databaseUrl,
});

export const db = drizzle(pool);
export type DbClient = typeof db;
