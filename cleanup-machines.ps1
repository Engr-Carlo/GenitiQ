# Cleanup script to remove extra machines from production database
# This will delete VMM-4, VMM-5, VMM-6, CMM-3, CMM-4 from the database

Write-Host "Starting machine cleanup..." -ForegroundColor Yellow

# Machine names to remove
$machinesToRemove = @("VMM-4", "VMM-5", "VMM-6", "CMM-3", "CMM-4")

Write-Host "`nMachines to be removed:" -ForegroundColor Cyan
$machinesToRemove | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }

$confirm = Read-Host "`nThis will permanently delete these machines and their associated data. Continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Cleanup cancelled." -ForegroundColor Yellow
    exit
}

Write-Host "`nConnecting to database..." -ForegroundColor Yellow

# Run Prisma Studio for manual deletion or use npx prisma db execute
# For now, let's create a SQL script

$sql = @"
-- Cleanup script: Remove extra machines
-- WARNING: This will delete machines and their related data

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
"@

# Save SQL to file
$sql | Out-File -FilePath "cleanup-machines.sql" -Encoding UTF8

Write-Host "`nSQL script created: cleanup-machines.sql" -ForegroundColor Green
Write-Host "`nTo execute the cleanup, run ONE of these commands:" -ForegroundColor Cyan
Write-Host "  1. Manual via Prisma Studio: npx prisma studio" -ForegroundColor White
Write-Host "  2. Execute SQL: cat cleanup-machines.sql | npx prisma db execute --stdin" -ForegroundColor White
Write-Host "`nAfter cleanup, verify by running: npx prisma studio" -ForegroundColor Yellow
