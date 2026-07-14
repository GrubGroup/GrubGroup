/*
  Warnings:

  - Reshapes `Qa` from one row per session into one row per (session, member),
    adding `user_id`, `preferred_cuisines`, and `disliked_cuisines`. Existing Qa
    rows carry no member attribution and are transient session data, so they are
    cleared before the NOT NULL `user_id` column is added (no backfill exists).
  - Drops `Session.avg_budget`. The averaged group budget is now computed on
    demand by the ai_service orchestrator and never persisted.
*/

-- Clear transient, un-attributable Qa rows before adding the required user_id.
DELETE FROM "Qa";

-- DropColumn
ALTER TABLE "Session" DROP COLUMN "avg_budget";

-- AlterTable
ALTER TABLE "Qa" ADD COLUMN     "user_id" INTEGER NOT NULL,
ADD COLUMN     "preferred_cuisines" TEXT[],
ADD COLUMN     "disliked_cuisines" TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Qa_session_id_user_id_key" ON "Qa"("session_id", "user_id");

-- AddForeignKey
ALTER TABLE "Qa" ADD CONSTRAINT "Qa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
