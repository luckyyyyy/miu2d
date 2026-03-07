import "dotenv/config";

import { db } from "./db/client";

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
  for (const user of seedUsers) {
    const existing = await db.user.findFirst({ where: { email: user.email } });

    if (!existing) {
      await db.user.create({ data: user });
    } else if (!existing.name) {
      await db.user.update({ where: { id: existing.id }, data: { name: user.name } });
    }
  }

  console.log("Seed completed");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
