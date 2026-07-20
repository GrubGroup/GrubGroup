/*
  Warnings:

  - You are about to drop the column `time_slot` on the `Qa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lon" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Qa" DROP COLUMN "time_slot";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "scheduled_for" TIMESTAMP(3);
