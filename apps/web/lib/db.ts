import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Singleton for Next.js dev hot-reload + serverless
// Note: no log config to keep compat with generated client
export const prisma: PrismaClient =
  (globalThis as unknown as { __prisma?: PrismaClient }).__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  (globalThis as unknown as { __prisma?: PrismaClient }).__prisma = prisma;
}

export default prisma;
