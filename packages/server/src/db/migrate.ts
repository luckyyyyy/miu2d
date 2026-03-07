/**
 * Production database migration runner for Prisma.
 *
 * Applies pending SQL migrations from prisma/migrations/ without requiring
 * the Prisma CLI binary (schema-engine). Uses pg directly to:
 *   1. Ensure _prisma_migrations tracking table exists.
 *   2. Baseline the 0_init migration if the DB already has the schema
 *      (i.e. migrating from the old Drizzle setup).
 *   3. Apply any unapplied migrations in order.
 *
 * Usage (production):
 *   docker exec miu2d-server node dist/db/migrate.js
 */

import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations");
const BASELINE_MIGRATION = "0_init";

function checksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("==> Ensuring _prisma_migrations table exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _prisma_migrations (
        id                  TEXT        NOT NULL,
        checksum            TEXT        NOT NULL,
        finished_at         TIMESTAMPTZ,
        migration_name      TEXT        NOT NULL,
        logs                TEXT,
        rolled_back_at      TIMESTAMPTZ,
        started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count INT         NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      )
    `);

    const { rows: appliedRows } = await pool.query<{ migration_name: string }>(
      "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL"
    );
    const applied = new Set(appliedRows.map((r) => r.migration_name));

    // Detect existing DB (Drizzle era): users table exists but 0_init not yet recorded.
    const { rows: existsRows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'users'
       ) AS exists`
    );
    const isExistingDb = existsRows[0]?.exists === true;

    const dirs = (
      await readdir(MIGRATIONS_DIR, { withFileTypes: true })
    )
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const name of dirs) {
      if (applied.has(name)) {
        console.log(`  ✓ ${name} — already applied`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
      const sql = await readFile(sqlPath, "utf8");
      const hash = checksum(sql);
      const id = randomUUID();

      if (name === BASELINE_MIGRATION && isExistingDb) {
        // Baseline: record as applied without executing SQL (schema already exists).
        console.log(`  ⊕ ${name} — baseline (existing schema, skipping SQL)`);
        await pool.query(
          `INSERT INTO _prisma_migrations
             (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES ($1, $2, now(), $3, now(), 1)`,
          [id, hash, name]
        );
      } else {
        console.log(`  → ${name} — applying...`);
        await pool.query("BEGIN");
        try {
          await pool.query(sql);
          await pool.query(
            `INSERT INTO _prisma_migrations
               (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
             VALUES ($1, $2, now(), $3, now(), 1)`,
            [id, hash, name]
          );
          await pool.query("COMMIT");
          console.log(`  ✓ ${name} — applied`);
        } catch (err) {
          await pool.query("ROLLBACK");
          throw err;
        }
      }
    }

    console.log("==> Migrations completed successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
