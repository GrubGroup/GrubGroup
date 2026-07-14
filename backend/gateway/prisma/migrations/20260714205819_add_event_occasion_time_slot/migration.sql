-- AlterTable: persist the host's occasion + time_slot on the durable Event.
-- (Snapshotted from the host's Qa row at session close, before Qa rows are deleted.)
ALTER TABLE "Event" ADD COLUMN     "occasion" TEXT,
ADD COLUMN     "time_slot" TEXT;

-- NOTE: `prisma migrate dev` auto-generated a `DROP INDEX "Restaurant_embedding_hnsw"`
-- here because the hand-created HNSW index (raw SQL in 20260708214540) lives on the
-- Unsupported("vector(1024)") column and is invisible to the Prisma schema, so Prisma
-- reads it as drift. Dropping it would silently disable ANN cosine search in ai_service.
-- The drop was removed; the index is intentionally NOT managed by Prisma. If a future
-- migration re-introduces this drop, delete it and keep the index.
