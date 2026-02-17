#!/bin/bash
# Quick Testing Script - Phase 1
# Run this to get started with immediate testing

echo "🧪 SALFANET RADIUS - Testing Phase 1"
echo "===================================="
echo ""

# 1. TypeScript Check
echo "1️⃣ Checking TypeScript errors..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "✅ TypeScript: 0 errors"
else
  echo "❌ TypeScript: Errors found!"
  exit 1
fi
echo ""

# 2. Build Check
echo "2️⃣ Testing production build..."
npm run build
if [ $? -eq 0 ]; then
  echo "✅ Build: Success"
else
  echo "❌ Build: Failed!"
  exit 1
fi
echo ""

# 3. Security Audit
echo "3️⃣ Running security audit..."
npm audit --audit-level=moderate
echo ""

# 4. Database Migration (with confirmation)
echo "4️⃣ Database Migration"
read -p "Do you want to run database migration? (BACKUP FIRST!) [y/N]: " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Creating backup..."
  mysqldump -u root -p billing_radius > backup_$(date +%Y%m%d_%H%M%S).sql
  
  echo "Running migration..."
  mysql -u root -p billing_radius < prisma/migrations/standardize_status_casing.sql
  
  echo "Verifying migration..."
  mysql -u root -p billing_radius -e "SELECT DISTINCT status FROM pppoe_users ORDER BY status;"
  echo "✅ Migration complete!"
else
  echo "⏭️  Skipped database migration"
fi
echo ""

# Summary
echo "======================================"
echo "✅ Quick Testing Phase 1 Complete!"
echo ""
echo "Next steps:"
echo "1. Start dev server: npm run dev"
echo "2. Manual E2E testing"
echo "3. Review docs/TESTING_GUIDE_2026-02-17.md"
echo ""
echo "Testing guide: docs/TESTING_GUIDE_2026-02-17.md"
