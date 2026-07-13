// Singleton Prisma client for the gateway.
//
// The domain schema lives at backend/gateway/prisma (owned by the gateway,
// which is the schema owner + primary Prisma writer per the architecture
// rules); the gateway reads/writes the User table directly ONLY for the auth
// vertical (register / login / Google linking). All other data access still
// goes through ai_service.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export { prisma };
