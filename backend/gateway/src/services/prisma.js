// Single shared PrismaClient instance for the gateway (the sole DB writer).
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
