-- DropIndex
DROP INDEX "Restaurant_embedding_hnsw";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "default_lat" DOUBLE PRECISION,
ADD COLUMN     "default_location" TEXT,
ADD COLUMN     "default_lon" DOUBLE PRECISION;
