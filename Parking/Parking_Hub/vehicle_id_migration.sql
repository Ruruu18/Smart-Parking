-- Migration to fix vehicle_id type mismatch in parking_sessions table
-- This migration safely changes vehicle_id from TEXT to UUID

-- Step 1: Add a new column with UUID type
ALTER TABLE parking_sessions ADD COLUMN vehicle_id_new UUID;

-- Step 2: Update the new column with converted values (only for valid UUIDs)
UPDATE parking_sessions 
SET vehicle_id_new = vehicle_id::UUID 
WHERE vehicle_id IS NOT NULL 
  AND vehicle_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: Drop the old column
ALTER TABLE parking_sessions DROP COLUMN vehicle_id;

-- Step 4: Rename the new column to the original name
ALTER TABLE parking_sessions RENAME COLUMN vehicle_id_new TO vehicle_id;

-- Step 5: Add the foreign key constraint
ALTER TABLE parking_sessions 
ADD CONSTRAINT fk_parking_sessions_vehicle_id 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- Step 6: Update the trigger function to handle UUID properly (already done in database.sql)

-- Step 7: Update any admin functions that reference vehicle_id
-- The get_vehicle_for_admin function already expects UUID, so no changes needed

-- Step 8: Update parking_spaces.vehicle_id to also be UUID for consistency
ALTER TABLE parking_spaces ADD COLUMN vehicle_id_new UUID;

UPDATE parking_spaces 
SET vehicle_id_new = vehicle_id::UUID 
WHERE vehicle_id IS NOT NULL 
  AND vehicle_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE parking_spaces DROP COLUMN vehicle_id;
ALTER TABLE parking_spaces RENAME COLUMN vehicle_id_new TO vehicle_id;

-- Add foreign key for parking_spaces.vehicle_id as well
ALTER TABLE parking_spaces 
ADD CONSTRAINT fk_parking_spaces_vehicle_id 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- Recreate the updated_at trigger for parking_sessions if it exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to parking_spaces (if not already exists)
DROP TRIGGER IF EXISTS update_parking_spaces_updated_at ON parking_spaces;
CREATE TRIGGER update_parking_spaces_updated_at 
    BEFORE UPDATE ON parking_spaces 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();