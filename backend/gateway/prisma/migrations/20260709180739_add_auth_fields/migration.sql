-- Add early custom-auth fields to User. This migration originally duplicated the
-- entire base schema (a copy of the initial migration), which broke replay with
-- `type "Role" already exists`. It has been reduced to its true delta over the
-- initial migration: the two auth columns and the google_id unique index (the
-- latter is dropped again by the switch_to_better_auth migration).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "google_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_google_id_key" ON "User"("google_id");
