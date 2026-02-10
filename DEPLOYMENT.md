# Queue Management System - Deployment Guide

## Prerequisites
- [x] GitHub repository created and code pushed
- [ ] Neon PostgreSQL account
- [ ] Vercel account

## Part 1: Neon Database Setup

### 1. Create Neon Project
1. Go to https://neon.tech
2. Sign in with GitHub
3. Click **"Create Project"**
4. Project Name: `qms-production`
5. Region: Choose closest to your users
6. Click **Create**

### 2. Get Connection Strings
After creation, Neon shows two connection strings:

**Pooled Connection (DATABASE_URL):**
```
postgresql://[user]:[password]@[host].neon.tech/[db]?sslmode=require
```

**Direct Connection (DIRECT_URL):**
```
postgresql://[user]:[password]@[host].neon.tech/[db]?sslmode=require&pooler=false
```

### 3. Update Local .env.local
Replace the placeholder values in `.env.local`:

```env
# Replace with your actual Neon credentials
DATABASE_URL="postgresql://[paste-pooled-connection-string-here]"
DIRECT_URL="postgresql://[paste-direct-connection-string-here]"

# Use the generated secret below
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A="

# App info
NEXT_PUBLIC_APP_NAME="Queue Management System"
NEXT_PUBLIC_COMPANY_NAME="Company XYZ"
```

### 4. Push Database Schema & Seed Data
Run these commands in PowerShell:

```powershell
# Push schema to Neon database
npx prisma db push

# Seed initial data (creates test users, machines, parts)
npm run db:seed
```

### 5. Test Database Connection
```powershell
# Open Prisma Studio to view your data
npm run db:studio
```

This will open http://localhost:5555 where you can see all your tables and data.

---

## Part 2: Vercel Deployment

### 1. Login to Vercel
1. Go to https://vercel.com
2. Click **"Sign Up"** or **"Login"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub account

### 2. Import Your Project
1. Click **"Add New..."** → **"Project"**
2. Find your QMS repository in the list
3. Click **"Import"**

### 3. Configure Project Settings

**Framework Preset:** Next.js (auto-detected)

**Root Directory:** `./` (default)

**Build Command:** `npm run build` (default)

**Output Directory:** `.next` (default)

### 4. Add Environment Variables
Click **"Environment Variables"** and add these:

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | Your Neon POOLED connection string | All |
| `DIRECT_URL` | Your Neon DIRECT connection string | All |
| `NEXTAUTH_URL` | `https://your-app-name.vercel.app` | Production |
| `NEXTAUTH_URL` | `http://localhost:3000` | Development |
| `NEXTAUTH_SECRET` | `7i5QjEaP935pSuPo4vAiF30k+MU4/sFY7jc+N+TEP4A=` | All |
| `NEXT_PUBLIC_APP_NAME` | `Queue Management System` | All |
| `NEXT_PUBLIC_COMPANY_NAME` | `Company XYZ` | All |

⚠️ **Important:** 
- Use the **same** Neon connection strings as your local `.env.local`
- After deployment, update `NEXTAUTH_URL` in Vercel with your actual domain (e.g., `https://qms-xyz.vercel.app`)

### 5. Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. Click **"Visit"** to see your live app!

### 6. Post-Deployment Setup

**Update NEXTAUTH_URL:**
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Edit `NEXTAUTH_URL` (Production)
3. Change to: `https://your-actual-domain.vercel.app`
4. Click **Save**
5. Go to **Deployments** → Click ⋯ on latest → **Redeploy**

---

## Part 3: Test Your Deployment

### Default Test Users (from seed data)

| Email | Password | Role |
|-------|----------|------|
| `admin@xyz.com` | `password123` | Admin |
| `inspector1@xyz.com` | `password123` | Inspector |
| `operator1@xyz.com` | `password123` | Operator |
| `qa1@xyz.com` | `password123` | QA/QC |

### Test Checklist
- [ ] Can login with admin account
- [ ] Dashboard loads correctly
- [ ] Can view machines
- [ ] Can view queue
- [ ] Can view inspections
- [ ] Can view analytics
- [ ] Settings pages accessible (Admin only)

---

## Troubleshooting

### Build Fails on Vercel
**Error:** `Prisma Client not generated`

**Fix:** Vercel automatically runs `prisma generate` via the `postinstall` script in package.json (already configured).

### Database Connection Error
**Error:** `Can't reach database server`

**Fix:** 
1. Verify connection strings in Vercel environment variables
2. Ensure strings include `?sslmode=require`
3. Check Neon project is not paused (free tier auto-pauses after inactivity)

### NextAuth Error on Production
**Error:** `[next-auth][error][NO_SECRET]`

**Fix:** Ensure `NEXTAUTH_SECRET` is set in Vercel environment variables.

### 404 on Login Redirect
**Fix:** Ensure `NEXTAUTH_URL` matches your exact Vercel domain (including https://).

---

## Continuous Deployment

Once set up, every `git push` to your main branch will:
1. ✅ Automatically trigger a new Vercel deployment
2. ✅ Build and deploy in 2-3 minutes
3. ✅ Go live immediately

---

## Database Migrations (Future Updates)

When you modify the Prisma schema:

```powershell
# Local development
npx prisma migrate dev --name describe_your_change

# Push to GitHub
git add .
git commit -m "Database schema update"
git push

# Vercel will automatically apply migrations on deploy
```

---

## Monitoring & Logs

**Vercel Logs:**
- Go to your project → **Deployments** → Click deployment → **Functions** tab
- Real-time logs for debugging

**Neon Database:**
- Go to Neon dashboard → Your project → **Monitoring**
- View query performance, connection pool usage

---

## Production Security Notes

🔒 **Before going live with real users:**

1. **Change Default Passwords**
   - Login as admin
   - Go to Settings → Users  
   - Update all default passwords

2. **Review Access Control**
   - Check RBAC permissions in `src/lib/rbac.ts`
   - Ensure proper role assignments

3. **Enable Neon Database Encryption**
   - Already enabled by default on Neon

4. **Set Up Custom Domain (Optional)**
   - Vercel Dashboard → Settings → Domains
   - Add your custom domain

---

## Support

- Neon Docs: https://neon.tech/docs
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Prisma Docs: https://www.prisma.io/docs

---

**Generated:** February 10, 2026  
**Next.js Version:** 15.5.12  
**Prisma Version:** 6.19.2
