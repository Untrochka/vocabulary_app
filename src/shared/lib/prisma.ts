import { PrismaClient } from "@prisma/client";

// Singleton via globalThis — in dev with HMR, Next.js re-executes the module
// on every file save, and without this each reload would spawn a new DB
// connection until you hit Neon's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
