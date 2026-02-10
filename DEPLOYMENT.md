# Queue Management System - Deployment Guide

## Prerequisites
- [ ] GitHub account
- [ ] Vercel account  
- [ ] Neon PostgreSQL account

---

## Part 1: Push to GitHub

### 1. Initialize Git Repository (if not already done)

```powershell
# Initialize git in your project folder
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial QMS commit - ready for deployment"
```

### 2. Create GitHub Repository

**Option A - New Repository:**
1. Go to https://github.com/new
2. Repository name: `qms` or `queue-management-system`  
3. Make it **Private** (recommended for production code)
4. **DON'T** check "Initialize with README" (we already have one)
5. Click **"Create repository"**

**Option B - Use Existing Repository:**
If you already have a repo, skip to step 3.

### 3. Push Your Code

```powershell
# Add your GitHub repo as remote
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Rename branch to main if needed
git branch -M main

# Push to GitHub
git push -u origin main
```

✅ **Checkpoint:** Your code is now on GitHub! You should see all files at `https://github.com/YOUR-USERNAME/YOUR-REPO`

---

## Part 2: Vercel Project Setup

### 1. Login to Vercel
1. Go to https://vercel.com
2. Click **"Sign Up"** or **"Login"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub account

### 2. Import Your Project
1. Click **"Add New..."** → **"Project"**
2. Find your QMS repository in the list
3. Click **"Import"**

### 3. Configure Framework Settings

Vercel will auto-detect Next.js. Verify these settings:

| Setting | Value | Status |
|---------|-------|--------|
| **Framework Preset** | Next.js | ✅ Auto-detected |
| **Root Directory** | `./` | ✅ Default |
| **Build Command** | `npm run build` | ✅ Default |
| **Output Directory** | `.next` | ✅ Default |
| **Install Command** | `npm install` | ✅ Default |
| **Node.js Version** | 20.x | ✅ Default |

### 4. Note Your Vercel Preview Domain

**Important:** Before deploying, Vercel assigns a preview domain like:
```
https://qms-abc123xyz.vercel.app
```

**Write this down!** You'll need it for `NEXTAUTH_URL` in the next steps.

⚠️ **Don't click Deploy yet!** We need environment variables first.

---

## Part 3: Neon Database Setup

### 1. Create Neon Project
1. Go to https://neon.tech
2. Sign in with GitHub
3. Click **"Create Project"**
4. Project Name: `qms-production`
5. PostgreSQL Version: 17 (latest)
6. Region: Choose closest to your users (e.g., US East for North America)
7. Click **Create**

### 2. Get Connection Strings

After creation, Neon shows your connection strings. You need **both**:

**Pooled Connection (DATABASE_URL):**
```
postgresql://username:password@ep-xyz-123.region.neon.tech/neondb?sslmode=require
```

**Direct Connection (DIRECT_URL):**  
Click "Show Direct URL" to get:
```
postgresql://username:password@ep-xyz-123.region.neon.tech/neondb?sslmode=require&pooler=false
```

📋 **Copy both strings** - you'll paste them into Vercel in the next part.

### 3. Keep Neon Tab Open
Don't close the Neon tab yet - we'll need these strings in Part 4.

---

## Part 4: Configure Vercel Environment Variables

Now that you have:
- ✅ Your Vercel domain (from Part 2, step 4)
- ✅ Your Neon connection strings (from Part 3, step 2)

Let's configure Vercel:

### 1. Add Environment Variables in Vercel
Back in your Vercel project setup page, click **"Environment Variables"** and add:

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | Paste your Neon **POOLED** connection string | From Part 3 step 2 |
| `DIRECT_URL` | Paste your Neon **DIRECT** connection string | From Part 3 step 2 |
| `NEXTAUTH_URL` | `https://YOUR-VERCEL-DOMAIN.vercel.app` | From Part 2 step 4 |
| `NEXTAUTH_SECRET` | `7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A=` | Already generated for you |
| `NEXT_PUBLIC_APP_NAME` | `Queue Management System` | Optional |
| `NEXT_PUBLIC_COMPANY_NAME` | `Company XYZ` | Optional |

### 2. Environment Selection
For each variable, select which environments to apply to:
- ✅ **Production** (required)
- ✅ **Preview** (recommended - for testing branches)
- ⬜ **Development** (not needed - use local `.env.local`)

### 3. Example Configuration

Here's what your Vercel env vars should look like:

```env
DATABASE_URL=postgresql://alex_owner:AbCdEf123@ep-cool-water-123.us-east-2.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://alex_owner:AbCdEf123@ep-cool-water-123.us-east-2.neon.tech/neondb?sslmode=require&pooler=false
NEXTAUTH_URL=https://qms-abc123xyz.vercel.app
NEXTAUTH_SECRET=7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A=
NEXT_PUBLIC_APP_NAME=Queue Management System
NEXT_PUBLIC_COMPANY_NAME=Company XYZ
```

⚠️ **Replace the example values** with your actual Neon strings and Vercel domain!

---

## Part 5: Deploy & Initialize Database

### 1. Deploy to Vercel
1. Click **"Deploy"**
2. Watch the build logs (2-3 minutes)
3. Wait for ✅ **"Deployment Complete"**
4. Click **"Visit"** to see your live app

### 2. Initialize Database Schema

Your app is deployed, but the database is empty. Run these commands locally to push the schema:

```powershell
# Create a .env.local file with your Neon credentials
@"
DATABASE_URL="postgresql://your-neon-pooled-url"
DIRECT_URL="postgresql://your-neon-direct-url"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A="
NEXT_PUBLIC_APP_NAME="Queue Management System"
NEXT_PUBLIC_COMPANY_NAME="Company XYZ"
"@ | Out-File -FilePath .env.local -Encoding utf8

# Push schema to Neon
npx prisma db push

# Seed initial data (creates test users, machines, parts)
npm run db:seed
```

### 3. Verify Database
```powershell
# Open Prisma Studio
npm run db:studio
```

This opens http://localhost:5555 where you can see all your tables and seed data.

---

## Part 6: Test Your Deployment

### Default Test Users (from seed data)

Visit `https://your-vercel-domain.vercel.app` and test:

| Email | Password | Role |
|-------|----------|------|
| `admin@xyz.com` | `password123` | Admin |
| `inspector1@xyz.com` | `password123` | Inspector |
| `operator1@xyz.com` | `password123` | Operator |
| `qa1@xyz.com` | `password123` | QA/QC |

### Test Checklist
- [ ] Can login with admin account
- [ ] Dashboard loads correctly
- [ ] Can view machines (8 machines from seed data)
- [ ] Can view queue (inspection queue items)
- [ ] Can view inspections history
- [ ] Can view analytics page
- [ ] Settings pages accessible (Admin only)
- [ ] Audit logs recording actions

---

## Troubleshooting

### Build Fails on Vercel
**Error:** `Prisma Client not generated`

**Fix:** Vercel automatically runs `prisma generate` via the `postinstall` script in `package.json` (already configured). If this still fails:
1. Check build logs for the exact error
2. Ensure `package.json` has `"postinstall": "prisma generate"`

### Database Connection Error
**Error:** `Can't reach database server`

**Fix:** 
1. Go to Vercel → Settings → Environment Variables
2. Verify `DATABASE_URL` and `DIRECT_URL` are correct
3. Ensure strings include `?sslmode=require`
4. Check Neon project is not paused:
   - Go to Neon dashboard
   - Free tier auto-pauses after inactivity
   - Click your project to wake it up

### NextAuth Error on Production
**Error:** `[next-auth][error][NO_SECRET]`

**Fix:** 
1. Go to Vercel → Settings → Environment Variables
2. Ensure `NEXTAUTH_SECRET` is set for Production
3. Redeploy the project

### 404 on Login Redirect
**Error:** Redirects to wrong URL after login

**Fix:** 
1. Go to Vercel → Settings → Environment Variables
2. Ensure `NEXTAUTH_URL` matches your exact Vercel domain
3. Include `https://` and no trailing slash
4. Example: `https://qms-xyz.vercel.app` (not `http` or `www`)

### Database Already Has Data
**Error:** `prisma db push` reports existing data

**Fix:** This is normal if you ran seed before. To reset:
```powershell
npx prisma migrate reset
```
⚠️ This deletes all data!

---

## Continuous Deployment

Once set up, every `git push` to your main branch will:
1. ✅ Automatically trigger a new Vercel deployment
2. ✅ Build and deploy in 2-3 minutes
3. ✅ Go live immediately

Example workflow:
```powershell
# Make changes to your code
code .

# Commit changes
git add .
git commit -m "Add new feature"

# Push to GitHub (triggers auto-deploy)
git push
```

Watch deployment progress at: https://vercel.com/YOUR-USERNAME/YOUR-PROJECT/deployments

---

## Database Migrations (Future Updates)

When you modify the Prisma schema:

```powershell
# 1. Update prisma/schema.prisma with your changes

# 2. Create migration locally
npx prisma migrate dev --name describe_your_change

# 3. Test locally
npm run dev

# 4. Push to GitHub (Vercel auto-deploys and applies migrations)
git add .
git commit -m "Database schema update: [describe change]"
git push
```

Vercel automatically runs migrations on deploy via the `postinstall` script.

---

## Monitoring & Logs

### Vercel Logs
1. Go to https://vercel.com
2. Select your project
3. Click **Deployments** → Latest deployment
4. Click **Functions** tab
5. Real-time logs for debugging

### Neon Database
1. Go to https://console.neon.tech
2. Select your project
3. Click **Monitoring**
4. View:
   - Query performance
   - Connection pool usage
   - Database size
   - Active connections

---

## Production Security Checklist

🔒 **Before going live with real users:**

### 1. Change Default Passwords
- Login as admin: `admin@xyz.com` / `password123`
- Go to **Settings** → **Users**  
- Update all default passwords to strong, unique passwords

### 2. Review Access Control
- Check role permissions in `src/lib/rbac.ts`
- Ensure proper role assignments
- Test each role's access restrictions

### 3. Enable Database Backups
- Neon free tier: Automatic backups (7 days retention)
- Neon paid tier: 30 days retention + point-in-time restore
- Consider upgrading for production use

### 4. Set Up Custom Domain (Optional)
1. Go to Vercel → Settings → Domains
2. Add your custom domain (e.g., `qms.company.com`)
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` to your custom domain
5. Redeploy

### 5. Add Production Users
- Create real user accounts with proper roles
- Disable or delete seed test accounts
- Implement password reset flow if needed

---

## Automated Setup Script

For faster local setup, use the provided PowerShell script:

```powershell
.\setup-database.ps1
```

This script:
1. Prompts for Neon connection strings
2. Creates `.env.local` automatically
3. Runs `prisma db push`
4. Runs `npm run db:seed`
5. Opens Prisma Studio

---

## Support & Documentation

- **Neon PostgreSQL:** https://neon.tech/docs
- **Vercel Deployment:** https://vercel.com/docs
- **Next.js 15:** https://nextjs.org/docs
- **Prisma ORM:** https://www.prisma.io/docs
- **NextAuth.js v5:** https://authjs.dev

---

## Deployment Checklist Summary

Use `DEPLOYMENT-CHECKLIST.md` for an interactive checklist.

**Quick Reference:**
1. ✅ Push to GitHub
2. ✅ Import to Vercel  
3. ✅ Note Vercel domain
4. ✅ Create Neon database
5. ✅ Get Neon connection strings
6. ✅ Add env vars to Vercel
7. ✅ Deploy
8. ✅ Push schema & seed data
9. ✅ Test login and features
10. ✅ Update default passwords

---

**Generated:** February 2025  
**Next.js Version:** 15.5.12  
**Prisma Version:** 6.19.2  
**NextAuth Version:** 5.0.0-beta.25

