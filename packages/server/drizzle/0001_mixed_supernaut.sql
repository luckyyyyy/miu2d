-- Add key column (nullable first for existing data)
ALTER TABLE "magics" ADD COLUMN "key" text;

-- Set default key value for existing records (use id as key)
UPDATE "magics" SET "key" = id::text WHERE "key" IS NULL;

-- Make key NOT NULL after populating
ALTER TABLE "magics" ALTER COLUMN "key" SET NOT NULL;

-- Add unique constraint
ALTER TABLE "magics" ADD CONSTRAINT "magics_game_id_key_unique" UNIQUE("game_id","key");