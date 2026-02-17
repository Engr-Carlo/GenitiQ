# Production Deployment Guide: QA/Inspector Merge

## Overview
This deployment merges the QA_QC role into INSPECTOR, giving inspectors both inspection and quality control capabilities.

## Development (Already Complete ✅)
- [x] Schema updated (QA_QC removed from UserRole enum)
- [x] Database seeded with test data
- [x] All dashboards updated to use database APIs
- [x] QA dashboard redirects to unified Inspector dashboard

## Production Deployment Steps

### Option 1: Using Prisma Migrate (Recommended for new deployments)
```powershell
# Apply the migration
npx prisma migrate deploy

# Update any existing QA_QC users
node update-qa-users.js
```

### Option 2: Manual SQL Migration (For existing production with data)
```powershell
# Run the production migration SQL
psql $DATABASE_URL -f migrate-production.sql

# Or using Prisma:
cat migrate-production.sql | npx prisma db execute --stdin
```

### Option 3: Using the update script only (If schema already updated)
```powershell
# If you've already pushed the schema change
node update-qa-users.js
```

## Verification

After deployment, verify the changes:

```powershell
# Check database state
node verify-database.js

# Verify no QA_QC users remain
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.user.findMany().then(u => console.log(u.map(x => ({email: x.email, role: x.role})))).finally(() => p.\$disconnect())"
```

## Testing Checklist

1. **Login Tests**
   - [ ] Former QA users can log in with INSPECTOR role
   - [ ] Inspector dashboard shows both Inspections and QA tabs
   - [ ] All buttons and features work with database

2. **Dashboard Tests**
   - [ ] Inspector Dashboard: Shows queued parts and inspection history
   - [ ] Operator Dashboard: Shows machines from database
   - [ ] Admin Dashboard: Shows analytics from database
   - [ ] Settings pages: Users, Audit Logs, Machine Reports all load data

3. **Database Tests**
   - [ ] Run `node verify-database.js` - should show data
   - [ ] No users with QA_QC role
   - [ ] All API endpoints return real data, not seeded mock data

## Rollback Plan

If issues occur, you can manually revert:

```sql
-- Add QA_QC back to enum
ALTER TYPE "UserRole" ADD VALUE 'QA_QC';

-- Restore specific users to QA_QC if needed
UPDATE "User" SET role = 'QA_QC' WHERE email = 'qa1@xyz.com';
```

## Files Modified

### Database
- `prisma/schema.prisma` - Removed QA_QC from UserRole enum
- `prisma/seed.ts` - Updated Victoria De Jose to INSPECTOR

### Code
- `src/app/dashboard/inspector/page.tsx` - Merged Inspector + QA functionality
- `src/app/dashboard/qa/page.tsx` - Now redirects to inspector
- `src/app/dashboard/operator/page.tsx` - Connected to /api/machines
- `src/app/dashboard/admin/page.tsx` - Connected to /api/analytics
- `src/lib/rbac.ts` - Merged QA permissions into INSPECTOR
- All settings pages - Fetch from database APIs

### Scripts
- `update-qa-users.js` - Migrates existing QA_QC users
- `verify-database.js` - Verifies database state
- `migrate-production.sql` - Production migration SQL

## Support

If you encounter issues:
1. Check database connection with `node verify-database.js`
2. Verify schema sync with `npx prisma validate`
3. Check application logs for API errors
4. Ensure all QA_QC references are updated in code
