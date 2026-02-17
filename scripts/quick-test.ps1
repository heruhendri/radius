# Quick Testing Script - Phase 1 (Windows PowerShell)
# Run this to get started with immediate testing

Write-Host "🧪 SALFANET RADIUS - Testing Phase 1" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 1. TypeScript Check
Write-Host "1️⃣ Checking TypeScript errors..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ TypeScript: 0 errors" -ForegroundColor Green
} else {
  Write-Host "❌ TypeScript: Errors found!" -ForegroundColor Red
  exit 1
}
Write-Host ""

# 2. Build Check
Write-Host "2️⃣ Testing production build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Build: Success" -ForegroundColor Green
} else {
  Write-Host "❌ Build: Failed!" -ForegroundColor Red
  exit 1
}
Write-Host ""

# 3. Security Audit
Write-Host "3️⃣ Running security audit..." -ForegroundColor Yellow
npm audit --audit-level=moderate
Write-Host ""

# 4. Database Migration (with confirmation)
Write-Host "4️⃣ Database Migration" -ForegroundColor Yellow
$response = Read-Host "Do you want to run database migration? (BACKUP FIRST!) [y/N]"
if ($response -eq 'y' -or $response -eq 'Y') {
  Write-Host "Creating backup..." -ForegroundColor Yellow
  $backupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
  mysqldump -u root -p billing_radius > $backupFile
  Write-Host "✅ Backup created: $backupFile" -ForegroundColor Green
  
  Write-Host "Running migration..." -ForegroundColor Yellow
  Get-Content "prisma\migrations\standardize_status_casing.sql" | mysql -u root -p billing_radius
  
  Write-Host "Verifying migration..." -ForegroundColor Yellow
  mysql -u root -p billing_radius -e "SELECT DISTINCT status FROM pppoe_users ORDER BY status;"
  Write-Host "✅ Migration complete!" -ForegroundColor Green
} else {
  Write-Host "⏭️  Skipped database migration" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Quick Testing Phase 1 Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start dev server: npm run dev"
Write-Host "2. Manual E2E testing"
Write-Host "3. Review docs\TESTING_GUIDE_2026-02-17.md"
Write-Host ""
Write-Host "Testing guide: docs\TESTING_GUIDE_2026-02-17.md" -ForegroundColor Cyan
