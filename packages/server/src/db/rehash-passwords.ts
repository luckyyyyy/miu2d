/**
 * One-off data migration: hash all plaintext passwords with bcrypt.
 *
 * Safe to run multiple times (idempotent):
 *   - Rows whose passwordHash already looks like a bcrypt hash are skipped.
 *
 * Usage (production):
 *   docker exec miu2d-server node dist/db/rehash-passwords.js
 */
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword, isBcryptHash } from "../utils/password";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("==> rehash-passwords: fetching users …");

  const rows = await prisma.$queryRaw<Array<{ id: string; password_hash: string }>>`
    SELECT id, password_hash FROM users
  `;

  const plaintext = rows.filter((u) => !isBcryptHash(u.password_hash));
  console.log(`    total users: ${rows.length}, plaintext passwords: ${plaintext.length}`);

  if (plaintext.length === 0) {
    console.log("==> Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const user of plaintext) {
    const hashed = await hashPassword(user.password_hash);
    await prisma.$executeRaw`UPDATE users SET password_hash = ${hashed} WHERE id = ${user.id}::uuid`;
    updated += 1;
    if (updated % 10 === 0) {
      console.log(`    rehashed ${updated}/${plaintext.length} …`);
    }
  }

  console.log(`==> Done — rehashed ${updated} password(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("rehash-passwords failed:", err);
  process.exit(1);
});
