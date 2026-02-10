# QMS Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ Local Setup (Before Deployment)
- [ ] Node.js 18+ installed
- [ ] npm install completed
- [ ] Dev server runs successfully (npm run dev)
- [ ] Build completes successfully (npm run build)

---

## 🔗 Step 1: GitHub Repository Setup

### Option A: New Repository
- [ ] Go to: https://github.com/new
- [ ] Name: `qms` or `queue-management-system`
- [ ] Privacy: **Private** (recommended)
- [ ] DON'T check "Initialize with README"
- [ ] Click "Create repository"

### Option B: Existing Repository
- [ ] Repository already exists on GitHub

### Push to GitHub (Both Options)
- [ ] Run: `git init` (if not already a git repo)
- [ ] Run: `git add .`
- [ ] Run: `git commit -m "Initial QMS commit - ready for deployment"`
- [ ] Run: `git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git`
- [ ] Run: `git branch -M main`
- [ ] Run: `git push -u origin main`
- [ ] ✅ Verify code is visible on GitHub

---

## 🚀 Step 2: Vercel Project Setup

### 2.1: Import Project to Vercel
- [ ] Go to https://vercel.com
- [ ] Click "Sign Up" or "Login"
- [ ] Choose "Continue with GitHub"
- [ ] Authorize Vercel to access GitHub
- [ ] Click "Add New..." → "Project"
- [ ] Find your QMS repository in the list
- [ ] Click "Import"

### 2.2: Configure Framework Settings
Vercel auto-detects Next.js - verify:
- [ ] Framework Preset: **Next.js** ✓
- [ ] Root Directory: `./` ✓
- [ ] Build Command: `npm run build` ✓
- [ ] Output Directory: `.next` ✓
- [ ] Install Command: `npm install` ✓
- [ ] Node.js Version: 20.x ✓

### 2.3: Note Your Vercel Domain
- [ ] Vercel shows preview domain (e.g., `qms-abc123xyz.vercel.app`)
- [ ] **Write this down** - you'll need it for NEXTAUTH_URL
- [ ] ⚠️ **DON'T CLICK DEPLOY YET**

---

## 🗃️ Step 3: Neon Database Setup

### 3.1: Create Neon Project
- [ ] Go to https://neon.tech
- [ ] Sign in with GitHub
- [ ] Click "Create Project"
- [ ] Project Name: `qms-production`
- [ ] PostgreSQL Version: 17 (latest)
- [ ] Region: Choose closest to your users
- [ ] Click "Create"

### 3.2: Get Connection Strings
After creation, copy BOTH strings:
- [ ] Copy **Pooled connection** (DATABASE_URL)
  - Example: `postgresql://user:pass@host.neon.tech/db?sslmode=require`
- [ ] Copy **Direct connection** (DIRECT_URL)
  - Click "Show Direct URL"
  - Has `&pooler=false` at the end
- [ ] Save both strings in a notepad - you'll paste them in the next step
- [ ] ⚠️ Keep this Neon tab open

---

## ⚙️ Step 4: Configure Vercel Environment Variables

Back in your Vercel project setup page:

### 4.1: Add Environment Variables
Click "Environment Variables" tab and add ALL of these:

- [ ] `DATABASE_URL`
  - Value: Paste your Neon **POOLED** connection string
  - Environment: ✓ Production, ✓ Preview
  
- [ ] `DIRECT_URL`
  - Value: Paste your Neon **DIRECT** connection string  
  - Environment: ✓ Production, ✓ Preview

- [ ] `NEXTAUTH_URL`
  - Value: `https://YOUR-VERCEL-DOMAIN.vercel.app` (from Step 2.3)
  - Environment: ✓ Production, ✓ Preview

- [ ] `NEXTAUTH_SECRET`
  - Value: `7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A=`
  - Environment: ✓ Production, ✓ Preview

- [ ] `NEXT_PUBLIC_APP_NAME`
  - Value: `Queue Management System`
  - Environment: ✓ Production, ✓ Preview

- [ ] `NEXT_PUBLIC_COMPANY_NAME`
  - Value: `Company XYZ`
  - Environment: ✓ Production, ✓ Preview

### 4.2: Verify All Variables Added
- [ ] Total: 6 environment variables configured
- [ ] All marked for Production & Preview environments
- [ ] None marked for Development (use local .env.local instead)

---

## 🎯 Step 5: Deploy to Vercel

### 5.1: Initial Deployment
- [ ] Click "Deploy" button
- [ ] Watch build logs
- [ ] Wait 2-3 minutes for build to complete
- [ ] Status shows: ✅ "Ready"
- [ ] Click "Visit" to see your live app

### 5.2: Verify Deployment
- [ ] App opens in browser
- [ ] URL is correct (matches your Vercel domain)
- [ ] ⚠️ You'll see errors - that's normal! Database is empty.

---

## 💾 Step 6: Initialize Database

Your app is deployed, but the database needs the schema and initial data.

### 6.1: Create Local Environment File
- [ ] In your project folder, create `.env.local`
- [ ] Add these variables:

```env
DATABASE_URL="postgresql://your-neon-pooled-url"
DIRECT_URL="postgresql://your-neon-direct-url"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A="
NEXT_PUBLIC_APP_NAME="Queue Management System"
NEXT_PUBLIC_COMPANY_NAME="Company XYZ"
```

- [ ] Replace `DATABASE_URL` with your actual Neon pooled string
- [ ] Replace `DIRECT_URL` with your actual Neon direct string
- [ ] Save file

### 6.2: Push Schema to Neon Database
Run these commands in PowerShell:

**Option A - Automated Script:**
- [ ] Run: `.\setup-database.ps1`
- [ ] Follow prompts

**Option B - Manual Commands:**
- [ ] Run: `npx prisma generate`
- [ ] Run: `npx prisma db push`
- [ ] Confirm with `y` when prompted
- [ ] Wait for "✔ Your database is now in sync"

### 6.3: Seed Initial Data
- [ ] Run: `npm run db:seed`
- [ ] Wait for success messages:
  - ✅ Created 6 users
  - ✅ Created 8 machines
  - ✅ Created 30 parts
  - ✅ Created 150 inspections
  - ✅ Created 25 queue items

### 6.4: Verify Database
- [ ] Run: `npm run db:studio`
- [ ] Opens: http://localhost:5555
- [ ] Check tables have data:
  - [ ] User: 6 records
  - [ ] Machine: 8 records
  - [ ] Part: 30 records
  - [ ] Inspection: 150+ records
  - [ ] InspectionQueue: 25+ records
- [ ] Close Prisma Studio (Ctrl+C in terminal)

---

## ✅ Step 7: Test Your Deployment

### 7.1: Test Login
- [ ] Visit your Vercel URL
- [ ] Redirects to `/login`
- [ ] Login page loads correctly
- [ ] Login with: `admin@xyz.com` / `password123`
- [ ] Successful login redirects to dashboard

### 7.2: Test Dashboard
- [ ] Dashboard page loads
- [ ] KPI cards show data
- [ ] Charts render correctly
- [ ] Navigation menu works

### 7.3: Test All Routes
- [ ] **Machines**: `/dashboard/machines` loads 8 machines
- [ ] **Queue**: `/dashboard/queue/cnc` shows queue items
- [ ] **Inspections**: `/dashboard/inspections` shows inspection records
- [ ] **Analytics**: `/dashboard/analytics` shows charts
- [ ] **Settings**: `/dashboard/settings/users` (Admin only)

### 7.4: Test Other User Roles
Logout and test other accounts:

- [ ] **Inspector**: `inspector1@xyz.com` / `password123`
  - Can view machines, queue, inspections
  - Cannot access settings

- [ ] **Operator**: `operator1@xyz.com` / `password123`
  - Can view machines, queue
  - Cannot access inspections or settings

- [ ] **QA/QC**: `qa1@xyz.com` / `password123`
  - Can view all pages including QA review
  - Cannot access settings

### 7.5: Verify Database Connectivity
- [ ] Neon dashboard shows active connections
- [ ] No connection errors in Vercel logs

---

## 🔒 Step 8: Production Security

### 8.1: Change Default Passwords
- [ ] Login as admin
- [ ] Navigate to **Settings** → **Users**
- [ ] Update password for: `admin@xyz.com`
- [ ] Update password for: `inspector1@xyz.com`
- [ ] Update password for: `operator1@xyz.com`
- [ ] Update password for: `qa1@xyz.com`
- [ ] Update other test accounts

### 8.2: Review Access Control
- [ ] Verify RBAC permissions in `src/lib/rbac.ts`
- [ ] Test each role's access restrictions
- [ ] Confirm Admins have full access
- [ ] Confirm other roles have limited access

### 8.3: Database Backups
- [ ] Check Neon backup settings
- [ ] Free tier: 7 days retention (automatic)
- [ ] Consider upgrading for production use

---

## 📊 Monitoring & Maintenance

### Monitor Deployments
- [ ] Bookmark: https://vercel.com/YOUR-USERNAME/YOUR-PROJECT
- [ ] Check deployment status regularly
- [ ] Review build logs for errors

### Monitor Database
- [ ] Bookmark: https://console.neon.tech
- [ ] Check database metrics:
  - [ ] Connection pool usage
  - [ ] Query performance
  - [ ] Database size
  - [ ] Active queries

### Continuous Deployment
- [ ] Understand: Every `git push` triggers auto-deploy
- [ ] Test locally before pushing:
  - [ ] `npm run build` passes
  - [ ] `npm run dev` works
  - [ ] No TypeScript errors

---

## 🎉 Deployment Complete!

**Your Queue Management System is now live!**

🌐 **Production URL:** `https://your-vercel-domain.vercel.app`

### Quick Reference Links
- 📘 **Full Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- 🔧 **Vercel Dashboard:** https://vercel.com/dashboard
- 🗄️ **Neon Console:** https://console.neon.tech
- 📚 **Vercel Docs:** https://vercel.com/docs
- 📚 **Neon Docs:** https://neon.tech/docs

### Default Test Accounts
| Email | Password | Role |
|-------|----------|------|
| admin@xyz.com | password123 | Admin |
| inspector1@xyz.com | password123 | Inspector |
| operator1@xyz.com | password123 | Operator |
| qa1@xyz.com | password123 | QA/QC |

⚠️ **IMPORTANT:** Change these passwords in production!

---

## 📝 Deployment Notes

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Vercel URL:** _______________  
**Neon Project:** _______________  
**GitHub Repo:** _______________

**Notes:**
```
_____________________________________
_____________________________________
_____________________________________
```

---

## 🐛 Common Issues & Solutions

### Issue: Build fails on Vercel
**Solution:**
- Check Vercel build logs for specific error
- Verify all environment variables are set
- Ensure `postinstall: prisma generate` exists in package.json

### Issue: Database connection error
**Solution:**
- Verify DATABASE_URL includes `?sslmode=require`
- Check Neon project is not paused (free tier auto-pauses)
- Go to Neon dashboard and wake up the project

### Issue: NextAuth error
**Solution:**
- Ensure NEXTAUTH_SECRET is set in Vercel
- Verify NEXTAUTH_URL matches exact Vercel domain (with https://)
- No trailing slash in NEXTAUTH_URL

### Issue: 404 after login
**Solution:**
- Clear browser cookies
- Verify NEXTAUTH_URL is correct
- Check Vercel deployment completed successfully

---

**Generated:** February 2025  
**For:** Queue Management System v1.0

