-- Add Qa.location_address: the free-text address a member entered for the
-- session, geocoded server-side into location_lat/location_lon at write time.
ALTER TABLE "Qa" ADD COLUMN "location_address" TEXT;
