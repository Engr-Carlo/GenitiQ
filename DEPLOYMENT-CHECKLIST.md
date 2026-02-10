# QMS Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ Local Setup (Before Deployment)
- [ ] Node.js 18+ installed
- [ ] npm install completed
- [ ] .env.local created and configured
- [ ] Database connection tested (npm run db:studio)
- [ ] Dev server runs successfully (npm run dev)
- [ ] Can login with test accounts

---

## 🗃️ Neon Database Setup

### Step 1: Create Neon Project
- [ ] Go to https://neon.tech
- [ ] Sign in with GitHub
- [ ] Click "Create Project"
- [ ] Name: `qms-production`
- [ ] Select region (closest to users)
- [ ] Click "Create"

### Step 2: Get Connection Strings
- [ ] Copy **Pooled connection** string
- [ ] Copy **Direct connection** string (has `&pooler=false`)
- [ ] Save both strings somewhere safe

### Step 3: Configure Local Environment
- [ ] Open `.env.local`
- [ ] Paste `DATABASE_URL` (pooled string)
- [ ] Paste `DIRECT_URL` (direct string)
- [ ] Update `NEXTAUTH_SECRET` to: `7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A=`
- [ ] Save file

### Step 4: Push Schema & Seed Data
- [ ] Run: `.\setup-database.ps1`
  - OR manually:
    - [ ] `npx prisma generate`
    - [ ] `npx prisma db push`
    - [ ] `npm run db:seed`
- [ ] Verify with: `npm run db:studio`
- [ ] Confirm 6 users, 10 machines, 30 parts created

---

## 🔗 GitHub Repository Setup

### Option A: Existing Repo
- [ ] Run: `git init`
- [ ] Run: `git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git`
- [ ] Run: `git add .`
- [ ] Run: `git commit -m "Initial QMS commit with deployment config"`
- [ ] Run: `git branch -M main`
- [ ] Run: `git push -u origin main`

### Option B: New Repo
- [ ] Go to: https://github.com/new
- [ ] Name: `qms` or `queue-management-system`
- [ ] Privacy: Private
- [ ] DON'T check "Initialize with README"
- [ ] Click "Create repository"
- [ ] Follow commands from Option A above

---

## 🚀 Vercel Deployment

### Step 1: Import Project
- [ ] Go to https://vercel.com
- [ ] Click "Sign Up" or "Login"
- [ ] Choose "Continue with GitHub"
- [ ] Authorize Vercel
- [ ] Click "Add New..." → "Project"
- [ ] Find your QMS repo
- [ ] Click "Import"

### Step 2: Configure Build Settings
Vercel auto-detects Next.js - no changes needed:
- [ ] Framework: Next.js ✓
- [ ] Root Directory: `./` ✓
- [ ] Build Command: `npm run build` ✓
- [ ] Output Directory: `.next` ✓

### Step 3: Add Environment Variables
Click "Environment Variables" tab, add ALL:

| Variable | Value | Environment |
|----------|-------|-------------|
| DATABASE_URL | [Neon pooled string] | All ✓ |
| DIRECT_URL | [Neon direct string] | All ✓ |
| NEXTAUTH_SECRET | `7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A=` | All ✓ |
| NEXTAUTH_URL | `https://your-app.vercel.app` | Production ✓ |
| NEXTAUTH_URL | `http://localhost:3000` | Development ✓ |
| NEXT_PUBLIC_APP_NAME | `Queue Management System` | All ✓ |
| NEXT_PUBLIC_COMPANY_NAME | `Company XYZ` | All ✓ |

Checklist:
- [ ] DATABASE_URL added
- [ ] DIRECT_URL added
- [ ] NEXTAUTH_SECRET added
- [ ] NEXTAUTH_URL added (both prod & dev)
- [ ] NEXT_PUBLIC_APP_NAME added
- [ ] NEXT_PUBLIC_COMPANY_NAME added

### Step 4: Deploy
- [ ] Click "Deploy"
- [ ] Wait 2-3 minutes
- [ ] Status: "Ready" ✓

### Step 5: Update NEXTAUTH_URL
- [ ] Copy your Vercel URL (e.g., `qms-abc123.vercel.app`)
- [ ] Go to: Settings → Environment Variables
- [ ] Find `NEXTAUTH_URL` (Production)
- [ ] Update to: `https://qms-abc123.vercel.app` (your actual URL)
- [ ] Click "Save"
- [ ] Go to: Deployments tab
- [ ] Click ⋯ menu on latest deployment
- [ ] Click "Redeploy"
- [ ] Wait for rebuild

---

## ✅ Post-Deployment Testing

### Test Basic Functionality
- [ ] Visit your Vercel URL
- [ ] Redirects to `/login` ✓
- [ ] Login page loads ✓
- [ ] Can login with `admin@xyz.com` / `password123`
- [ ] Dashboard loads ✓
- [ ] Navigation works ✓

### Test Each Role
- [ ] Admin dashboard accessible
- [ ] Inspector dashboard accessible
- [ ] Operator dashboard accessible
- [ ] QA/QC dashboard accessible

### Test Key Features
- [ ] Can view machines list
- [ ] Can view queue
- [ ] Can view inspections
- [ ] Can view analytics
- [ ] Settings pages work (Admin only)
- [ ] Logout works

### Verify Database
- [ ] Neon dashboard shows active queries
- [ ] Connection pool utilization visible
- [ ] No connection errors in Vercel logs

---

## 🔒 Security Hardening (Before Production Use)

### Change Default Passwords
- [ ] Login as admin
- [ ] Go to: Settings → Users
- [ ] Update all test account passwords
- [ ] Use strong passwords (16+ chars)

### Review Access
- [ ] Verify role assignments correct
- [ ] Check RBAC permissions in code
- [ ] Ensure least privilege access

### Optional Enhancements
- [ ] Add custom domain (Vercel Settings → Domains)
- [ ] Enable Vercel Analytics
- [ ] Set up Vercel monitoring
- [ ] Configure Neon branch protection

---

## 🐛 Troubleshooting

### Build Fails
- [ ] Check Vercel build logs
- [ ] Verify all environment variables set
- [ ] Ensure DATABASE_URL is correct

### Database Connection Error
- [ ] Verify Neon project not paused
- [ ] Check connection strings include `?sslmode=require`
- [ ] Test connection from Neon dashboard

### Login/Auth Issues
- [ ] Verify NEXTAUTH_URL matches exact domain
- [ ] Check NEXTAUTH_SECRET is set
- [ ] Clear browser cookies and retry

### 404 Errors
- [ ] Ensure build completed successfully
- [ ] Check Vercel function logs
- [ ] Verify routes exist in code

---

## 📊 Monitoring

### Daily Checks
- [ ] Vercel deployment status
- [ ] Neon connection pool usage
- [ ] Error rate in Vercel logs

### Weekly Reviews
- [ ] Review audit logs
- [ ] Check database size
- [ ] Monitor page load times

---

## ✨ Deployment Complete!

Your QMS is now live at: `https://your-app.vercel.app`

**Next Steps:**
1. Share URL with team
2. Update passwords
3. Configure user accounts
4. Start using the system!

**Support:**
- Deployment Guide: DEPLOYMENT.md
- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Vercel URL:** _______________  
**Neon Project:** _______________
