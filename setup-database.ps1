# QMS Database Setup Script
# Run this after updating .env.local with your Neon credentials

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "QMS Database Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ Error: .env.local not found!" -ForegroundColor Red
    Write-Host "   Please copy .env.example to .env.local and update with your Neon credentials" -ForegroundColor Yellow
    exit 1
}

# Check if DATABASE_URL is updated
$envContent = Get-Content ".env.local" -Raw
if ($envContent -match 'user:password@host\.neon\.tech') {
    Write-Host "⚠️  Warning: .env.local still contains placeholder values!" -ForegroundColor Yellow
    Write-Host "   Please update DATABASE_URL and DIRECT_URL with your actual Neon credentials" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 0
    }
}

Write-Host "Step 1: Generating Prisma Client..." -ForegroundColor Green
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Pushing schema to database..." -ForegroundColor Green
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push schema to database" -ForegroundColor Red
    Write-Host "   Please check your DATABASE_URL in .env.local" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Database schema created" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Seeding database with initial data..." -ForegroundColor Green
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database seeded successfully" -ForegroundColor Green
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default Test Users:" -ForegroundColor Yellow
Write-Host "  • admin@xyz.com / password123 (Admin)" -ForegroundColor White
Write-Host "  • inspector1@xyz.com / password123 (Inspector)" -ForegroundColor White
Write-Host "  • operator1@xyz.com / password123 (Operator)" -ForegroundColor White
Write-Host "  • qa1@xyz.com / password123 (QA/QC)" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run 'npm run dev' to start development server" -ForegroundColor White
Write-Host "  2. Visit http://localhost:3000" -ForegroundColor White
Write-Host "  3. Login with one of the test accounts" -ForegroundColor White
Write-Host ""
Write-Host "View Database:" -ForegroundColor Yellow
Write-Host "  Run 'npm run db:studio' to open Prisma Studio" -ForegroundColor White
Write-Host ""
