-- Cleanup script: Remove extra machines from production database
-- This removes VMM-4, VMM-5, VMM-6, CMM-3, CMM-4
-- WARNING: This will permanently delete these machines and ALL related data

BEGIN;

-- Delete inspection queues for these machines
DELETE FROM "InspectionQueue" 
WHERE "machineId" IN (
    SELECT id FROM "Machine" 
    WHERE name IN ('VMM-4', 'VMM-5', 'VMM-6', 'CMM-3', 'CMM-4')
);

-- Delete sessions for these machines
DELETE FROM "Session" 
WHERE "machineId" IN (
    SELECT id FROM "Machine" 
    WHERE name IN ('VMM-4', 'VMM-5', 'VMM-6', 'CMM-3', 'CMM-4')
);

-- Delete inspections for these machines
DELETE FROM "Inspection" 
WHERE "machineId" IN (
    SELECT id FROM "Machine" 
    WHERE name IN ('VMM-4', 'VMM-5', 'VMM-6', 'CMM-3', 'CMM-4')
);

-- Delete part references for these machines
DELETE FROM "PartReference" 
WHERE "machineId" IN (
    SELECT id FROM "Machine" 
    WHERE name IN ('VMM-4', 'VMM-5', 'VMM-6', 'CMM-3', 'CMM-4')
);

-- Finally, delete the machines themselves
DELETE FROM "Machine" 
WHERE name IN ('VMM-4', 'VMM-5', 'VMM-6', 'CMM-3', 'CMM-4');

COMMIT;
