import "dotenv/config";

import { eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { users } from "./db/schema";

const seedUsers = [
  {
    name: "Admin",
    email: "admin@example.com",
    passwordHash: "password",
    role: "admin",
  },
  {
    name: "User",
    email: "user@example.com",
    passwordHash: "password",
    role: "user",
  },
];

async function seed() {
  await db.execute(sql`create extension if not exists "pgcrypto";`);

  await db.execute(sql`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null default 'user',
      created_at timestamptz default now()
    )
  `);

  for (const user of seedUsers) {
    const existing = await db.select().from(users).where(eq(users.email, user.email));

    if (existing.length === 0) {
      await db.insert(users).values(user);
    } else if (!existing[0].name) {
      await db.update(users).set({ name: user.name }).where(eq(users.id, existing[0].id));
    }
  }

  console.log("Seed completed");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
