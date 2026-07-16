-- Rename default_location -> default_address (data-preserving) and add
-- default_radius (preferred search radius in miles).
ALTER TABLE "Profile" RENAME COLUMN "default_location" TO "default_address";

ALTER TABLE "Profile" ADD COLUMN "default_radius" DOUBLE PRECISION;
