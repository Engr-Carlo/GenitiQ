# Queue Management System (QMS)

A professional web application for managing inspection queues with genetic algorithm-based optimization.

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with your Neon PostgreSQL credentials.

3. **Setup Database**
   ```powershell
   .\setup-database.ps1
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### Default Test Accounts
| Email | Password | Role |
|-------|----------|------|
| admin@xyz.com | password123 | Admin |
| inspector1@xyz.com | password123 | Inspector |
| operator1@xyz.com | password123 | Operator |
| qa1@xyz.com | password123 | QA/QC |

## 📦 Deployment to Vercel

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment guide.

**Quick Steps:**
1. Create Neon PostgreSQL database → Get connection strings
2. Update `.env.local` with database credentials
3. Run `.\setup-database.ps1` to push schema & seed data
4. Push code to GitHub
5. Import to Vercel → Add environment variables → Deploy

## 🏗️ Tech Stack

- **Framework:** Next.js 15.5 (App Router)
- **Database:** PostgreSQL (Neon) + Prisma ORM
- **Auth:** NextAuth.js v5
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Deployment:** Vercel

## ✨ Features

- Multi-role authentication (Inspector, Operator, QA/QC, Admin)
- Real-time queue management
- Genetic Algorithm queue optimization
- Inspection workflow with QA override
- Machine status monitoring
- Analytics & reporting dashboard
- Audit logging & user management

## 📝 Documentation

- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Database Schema:** [prisma/schema.prisma](./prisma/schema.prisma)

---

**Built with Next.js, Prisma, and Tailwind CSS**

