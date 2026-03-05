import { PrismaClient } from "@prisma/client";
import { env } from "../env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: env.databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type DbClient = typeof db;
