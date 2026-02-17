-- Production Migration: Merge QA_QC role into INSPECTOR
-- This script safely migrates existing QA_QC users to INSPECTOR and removes the QA_QC enum value
-- Safe to run even if database already has new schema

DO $$
DECLARE
  has_qa_qc BOOLEAN;
BEGIN
  -- Check if QA_QC enum value exists
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'QA_QC'
  ) INTO has_qa_qc;

  IF has_qa_qc THEN
    RAISE NOTICE 'QA_QC enum value found. Starting migration...';
    
    -- Step 1: Update all QA_QC users to INSPECTOR role
    UPDATE "User"
    SET role = 'INSPECTOR'::text::"UserRole"
    WHERE role::text = 'QA_QC';
    
    RAISE NOTICE 'Updated QA_QC users to INSPECTOR';
    
    -- Step 2: Create new enum without QA_QC
    CREATE TYPE "UserRole_new" AS ENUM ('INSPECTOR', 'OPERATOR', 'ADMIN');
    
    -- Step 3: Alter the User table to use the new enum
    ALTER TABLE "User" 
      ALTER COLUMN role TYPE "UserRole_new" 
      USING role::text::"UserRole_new";
    
    -- Step 4: Drop the old enum and rename the new one
    DROP TYPE "UserRole";
    ALTER TYPE "UserRole_new" RENAME TO "UserRole";
    
    RAISE NOTICE 'Migration completed successfully!';
  ELSE
    RAISE NOTICE 'QA_QC enum value not found. Database already migrated or no migration needed.';
  END IF;
END $$;

-- Verification query (shows current user roles)
SELECT role, COUNT(*) as count FROM "User" GROUP BY role ORDER BY role;
