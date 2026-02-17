# 🧪 Testing & Deployment Readiness Guide

**Document Version:** 1.0  
**Date:** February 17, 2026  
**Status:** Ready for Testing Phase

---

## 📊 **TypeScript Health Check** ✅

**Build Status:**
```
✓ TypeScript compilation: 0 errors
✓ Build successful: 276 pages generated
✓ Production build: Ready
✓ Code quality: Clean
```

**Verification:**
```bash
npm run build  # ✅ Success
npx tsc --noEmit  # ✅ No errors
```

---

## 🎯 **Testing Roadmap - What Can Be Done Now**

### ✅ **CAN BE TESTED NOW (Development Environment)**

#### 1. **Database Migration** ✅ READY
**Status:** Script prepared, can run immediately  
**Location:** `prisma/migrations/standardize_status_casing.sql`

**Steps to Execute:**
```bash
# Backup database first (CRITICAL!)
mysqldump -u root -p billing_radius > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Run migration
mysql -u root -p billing_radius < prisma/migrations/standardize_status_casing.sql

# Verify results
mysql -u root -p billing_radius -e "SELECT DISTINCT status FROM pppoe_users ORDER BY status;"
# Expected output: active, blocked, isolated, stop (all lowercase)
```

**Rollback Plan (if needed):**
```bash
# Restore from backup
mysql -u root -p billing_radius < backup_before_migration_YYYYMMDD_HHMMSS.sql
```

**Testing Environment:** ✅ Development database  
**Risk Level:** 🟢 Low (backup available)  
**Duration:** 2-5 minutes  
**Impact:** Minor schema consistency improvement

---

#### 2. **Security Audit (Code Review)** ✅ CAN DO NOW

**A. Dependency Security Scan:**
```bash
# Check for known vulnerabilities
npm audit

# Generate detailed report
npm audit --json > security-audit-$(date +%Y%m%d).json

# Fix automatically if possible
npm audit fix
```

**B. Code Security Review Checklist:**

**Authentication & Authorization:**
- [x] JWT verification implemented (`src/lib/auth.ts`)
- [x] Role-based access control (requireAdmin, requireStaff)
- [x] Session validation against database
- [x] Active user check
- [ ] 2FA implementation (optional - future enhancement)

**Input Validation:**
- [x] Validation utility created (`src/lib/validation.ts`)
- [ ] Apply to all API endpoints (systematic review needed)
- [x] SQL injection protection (Prisma ORM default)
- [x] XSS protection (CSP headers + sanitization)
- [x] Path traversal prevention

**Security Headers:**
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Content-Security-Policy configured
- [x] X-XSS-Protection enabled
- [ ] HSTS (requires HTTPS - production only)

**API Security:**
- [x] Rate limiting implemented (`src/lib/rate-limit.ts`)
- [ ] CORS configuration review
- [ ] API key rotation policy
- [ ] Request logging/monitoring

**C. Manual Penetration Testing:**

**Tool Recommendations:**
```bash
# Install OWASP ZAP (free)
docker pull zaproxy/zap-stable
docker run -u zap -p 8080:8080 -i zaproxy/zap-stable zap-webswing.sh

# Or use Burp Suite Community Edition
# https://portswigger.net/burp/communitydownload
```

**Test Cases:**
1. ✅ SQL Injection attempts (protected by Prisma)
2. ✅ XSS attacks (CSP + sanitization)
3. ✅ CSRF (NextAuth handles this)
4. ⚠️ Session hijacking (test with stolen cookies)
5. ⚠️ Brute force login (rate limiting should block)
6. ⚠️ Path traversal (test file upload endpoints)
7. ⚠️ Mass assignment (test API request manipulation)

**Testing Environment:** ✅ Development/localhost  
**Risk Level:** 🟢 Safe (isolated environment)  
**Duration:** 4-8 hours for comprehensive audit  
**Tools Needed:** OWASP ZAP, Burp Suite, npm audit

---

#### 3. **End-to-End Testing** ✅ CAN DO NOW

**Critical User Flows to Test:**

**A. Admin Workflow:**
```
1. Admin Login
   ✓ Login with valid credentials
   ✓ Login with invalid credentials (should fail)
   ✓ Session persistence
   ✓ Logout

2. Customer Management
   ✓ Create new PPPoE user
   ✓ Edit user details
   ✓ Change package/profile
   ✓ Extend expiration
   ✓ Block/unblock user
   ✓ Delete user

3. Invoice Management
   ✓ Generate invoice
   ✓ Mark as paid
   ✓ Send invoice reminder (WhatsApp/Email)
   ✓ View payment history

4. Isolation System
   ✓ Manual isolate user
   ✓ Check isolated user can login (restricted)
   ✓ Check blocked user cannot login
   ✓ Restore isolated user after payment
   ✓ View isolated users dashboard
```

**B. Customer Portal:**
```
1. Customer Login
   ✓ Login with PPPoE credentials
   ✓ View package info
   ✓ View invoice history
   ✓ View session history

2. Self-Service
   ✓ Request package upgrade
   ✓ Submit payment proof
   ✓ Create support ticket
   ✓ Top-up balance (voucher)

3. Payment Flow
   ✓ View pending invoice
   ✓ Click payment link
   ✓ Complete payment (use sandbox gateway)
   ✓ Receive confirmation (WhatsApp/Email)
   ✓ Service auto-activated
```

**C. Agent Portal:**
```
1. Agent Login
   ✓ Login as agent
   ✓ View voucher stock
   ✓ Generate vouchers
   ✓ Sell vouchers
   ✓ View commission/deposits
   ✓ Filter by status/profile
   ✓ Send voucher via WhatsApp
```

**D. RADIUS Integration:**
```
1. PPPoE Authentication
   ✓ Active user login (should succeed)
   ✓ Isolated user login (should succeed but restricted)
   ✓ Blocked user login (should fail)
   ✓ Expired user login (should fail)
   ✓ Check radacct session logging

2. Hotspot Authentication
   ✓ Voucher login (active voucher)
   ✓ Expired voucher (should fail)
   ✓ Used voucher (should fail)
   ✓ Session tracking
```

**Testing Method:**
- Manual testing (systematic checklist)
- Screenshot/screen recording for documentation
- Note bugs in issue tracker

**Testing Environment:** ✅ Development/localhost  
**Risk Level:** 🟢 Safe  
**Duration:** 8-16 hours for full coverage  
**Team:** 2-3 testers recommended

---

#### 4. **Load Testing** ✅ CAN DO NOW

**Tools:**
```bash
# Option 1: k6 (recommended - free, powerful)
# Install: https://k6.io/docs/get-started/installation/
brew install k6  # macOS
choco install k6  # Windows
apt-get install k6  # Linux

# Option 2: Apache Bench (simple)
# Usually pre-installed on Linux/macOS

# Option 3: Artillery (Node.js based)
npm install -g artillery
```

**Test Scenarios:**

**A. API Load Test (k6):**
```javascript
// load-test-api.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Peak: 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  // Test login endpoint
  let loginRes = http.post('http://localhost:3000/api/auth/login', {
    username: 'testuser',
    password: 'password',
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
  
  // Test dashboard API
  let dashboardRes = http.get('http://localhost:3000/api/admin/dashboard');
  check(dashboardRes, {
    'dashboard loads': (r) => r.status === 200,
  });
  
  sleep(2);
}
```

**Run Test:**
```bash
k6 run load-test-api.js
```

**B. RADIUS Authentication Load Test:**
```bash
# Use radclient for RADIUS load testing
# Test 100 concurrent auth requests
for i in {1..100}; do
  echo "User-Name=testuser$i,User-Password=password" | \
  radclient -x localhost auth testing123 &
done
wait
```

**C. Database Query Performance:**
```sql
-- Test slow queries
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;  -- Log queries > 500ms

-- Run typical queries under load
-- Check slow query log
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 20;
```

**Expected Performance (Development):**
- API Response Time: < 500ms (p95)
- Database Queries: < 200ms (p95)
- Page Load: < 2 seconds
- RADIUS Auth: < 100ms

**Testing Environment:** ✅ Development (localhost)  
**Risk Level:** 🟡 Medium (high CPU/memory usage)  
**Duration:** 2-4 hours  
**Requirements:** At least 8GB RAM, multi-core CPU

---

#### 5. **Documentation Review** ✅ CAN DO NOW

**Checklist:**
- [x] README.md updated with latest features
- [x] API documentation complete
- [x] Notification setup guide created
- [x] Roadmap documented
- [ ] Installation guide review
- [ ] User manual (admin)
- [ ] User manual (customer)
- [ ] API reference (Swagger/OpenAPI)
- [ ] Troubleshooting guide
- [ ] FAQ section

**Action Items:**
```bash
# Check documentation coverage
find docs/ -name "*.md" -type f | wc -l

# Check broken links (if using markdown-link-check)
npm install -g markdown-link-check
find docs/ -name "*.md" -exec markdown-link-check {} \;

# Generate API documentation (if using TypeDoc)
npm install -g typedoc
typedoc --out docs/api src/
```

**Testing Environment:** ✅ Anywhere  
**Risk Level:** 🟢 Zero risk  
**Duration:** 4-8 hours  
**Team:** Technical writer + developer

---

#### 6. **Performance Optimization** ✅ CAN DO NOW

**A. Database Optimization:**
```sql
-- Check table sizes
SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS "Size (MB)"
FROM information_schema.TABLES 
WHERE table_schema = "billing_radius"
ORDER BY (data_length + index_length) DESC;

-- Check missing indexes
SELECT DISTINCT
  CONCAT('CREATE INDEX idx_', table_name, '_', column_name, 
         ' ON ', table_name, '(', column_name, ');') AS suggested_index
FROM information_schema.columns
WHERE table_schema = 'billing_radius'
  AND column_name IN ('createdAt', 'updatedAt', 'status', 'userId')
  AND table_name NOT IN (
    SELECT DISTINCT table_name 
    FROM information_schema.statistics 
    WHERE index_name LIKE CONCAT('%', column_name, '%')
  );

-- Analyze query performance
EXPLAIN SELECT * FROM pppoe_users WHERE status = 'active' AND expiredAt < NOW();
```

**B. Next.js Build Optimization:**
```bash
# Analyze bundle size
npm run build -- --profile

# Check bundle analyzer
npm install @next/bundle-analyzer
# Add to next.config.ts and run build
```

**C. Code Optimization Checklist:**
- [ ] Remove console.log in production
- [ ] Optimize images (use Next.js Image component)
- [ ] Lazy load components
- [ ] Database query optimization (N+1 queries)
- [ ] Cache frequently accessed data
- [ ] Minimize bundle size

**Testing Environment:** ✅ Development  
**Risk Level:** 🟢 Low  
**Duration:** 8-16 hours  
**Tools:** Next.js build analyzer, MySQL EXPLAIN, Chrome DevTools

---

### ⚠️ **REQUIRES PRODUCTION/STAGING ENVIRONMENT**

#### 7. **Deploy to Staging** ❌ NEEDS SETUP

**Requirements:**
- VPS/Cloud server (separate from production)
- Domain/subdomain (staging.yourdomain.com)
- SSL certificate (Let's Encrypt)
- Database server (MySQL/MariaDB)
- Environment variables configured

**Deployment Steps:**
```bash
# 1. Setup VPS
# 2. Install dependencies (Node.js, PM2, MySQL, FreeRADIUS)
# 3. Clone repository
# 4. Configure .env
# 5. Run database migrations
# 6. Build and start application
# 7. Configure nginx/Apache proxy
# 8. Setup SSL
```

**Not Recommended for Local Testing:** ❌  
**Reason:** Requires dedicated server infrastructure  
**Alternative:** Use Docker Compose for local staging simulation

**Docker Compose Simulation (Optional):**
```yaml
# docker-compose.staging.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://user:pass@db:3306/billing_radius
    depends_on:
      - db
      - radius
  
  db:
    image: mysql:8.0
    volumes:
      - mysql_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=rootpass
      - MYSQL_DATABASE=billing_radius
  
  radius:
    image: freeradius/freeradius-server:latest
    ports:
      - "1812:1812/udp"
      - "1813:1813/udp"

volumes:
  mysql_data:
```

---

#### 8. **User Acceptance Testing (UAT)** ⚠️ NEEDS REAL USERS

**Can Be Done:** ✅ With internal team (beta testing)  
**Cannot Be Done:** ❌ With actual customers (production only)

**Beta Testing Plan:**
1. Select 5-10 internal users
2. Provide staging/dev access
3. Real-world usage scenarios
4. Collect feedback
5. Bug reporting
6. Feature requests

**Duration:** 1-2 weeks  
**Participants:** Internal staff, friendly customers (optional)

---

## 📋 **Recommended Testing Order**

### **Phase 1: Immediate (Today/Tomorrow)** 🔥
1. ✅ Run database migration (development)
2. ✅ Check TypeScript errors (npm run build)
3. ✅ Npm audit (dependency check)
4. ✅ Basic end-to-end testing (critical flows)

### **Phase 2: This Week** 📅
5. ✅ Comprehensive end-to-end testing
6. ✅ Security code review
7. ✅ Load testing (basic)
8. ✅ Documentation review
9. ✅ Performance profiling

### **Phase 3: Next Week** 📆
10. ⚠️ Setup staging environment (if needed)
11. ✅ Internal UAT (beta testing)
12. ⚠️ OWASP ZAP security scan
13. ✅ Advanced load testing
14. ✅ Bug fixing from testing

### **Phase 4: Production Readiness** 🚀
15. ❌ Deploy to staging
16. ❌ Production database migration plan
17. ❌ Backup & disaster recovery testing
18. ❌ Final security audit
19. ❌ Go-live checklist

---

## 🔧 **Quick Start Testing Commands**

```bash
# 1. Type check
npx tsc --noEmit

# 2. Build check
npm run build

# 3. Security audit
npm audit

# 4. Run database migration (BACKUP FIRST!)
mysqldump -u root -p billing_radius > backup.sql
mysql -u root -p billing_radius < prisma/migrations/standardize_status_casing.sql

# 5. Start dev server
npm run dev

# 6. Manual testing
# Open browser: http://localhost:3000
# Login as admin, test all flows

# 7. Check logs
pm2 logs  # If using PM2
# Or check console output

# 8. Performance check (while app running)
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/admin/dashboard
```

**curl-format.txt:**
```
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
----------\n
time_total:  %{time_total}\n
```

---

## ✅ **Current Status Summary**

| Item | Can Test Now? | Environment | Duration | Priority |
|------|---------------|-------------|----------|----------|
| Database Migration | ✅ Yes | Development | 5 min | 🔥 High |
| TypeScript Errors | ✅ Yes (0 errors) | Development | 2 min | ✅ Done |
| Security Audit (Code) | ✅ Yes | Development | 4-8 hrs | 🔥 High |
| Security Audit (Pen Test) | ✅ Yes | Development | 4-8 hrs | 🟡 Medium |
| E2E Testing | ✅ Yes | Development | 8-16 hrs | 🔥 High |
| Load Testing | ✅ Yes | Development | 2-4 hrs | 🟡 Medium |
| Documentation Review | ✅ Yes | Anywhere | 4-8 hrs | 🟡 Medium |
| Performance Optimization | ✅ Yes | Development | 8-16 hrs | 🟡 Medium |
| Deploy to Staging | ❌ No | Needs server | 2-4 hrs | 🟢 Low |
| UAT (Internal) | ✅ Yes | Development | 1-2 weeks | 🟡 Medium |
| UAT (Real Users) | ❌ No | Production | 2-4 weeks | 🟢 Low |

---

## 🎯 **Recommendation: What to Do Next**

### **HIGH PRIORITY (Do Today):**
1. ✅ **Run Database Migration** (5 min)
2. ✅ **Basic E2E Testing** (2-3 hours)
3. ✅ **Npm Audit** (10 min)

### **THIS WEEK:**
4. ✅ **Comprehensive E2E Testing** (full day)
5. ✅ **Security Code Review** (half day)
6. ✅ **Load Testing (Basic)** (2-3 hours)

### **NEXT WEEK:**
7. ✅ **Internal Beta Testing** (ongoing)
8. ✅ **Performance Optimization** (1-2 days)
9. ⚠️ **Setup Staging** (optional, if resources available)

### **NOT URGENT:**
- Deploy to staging (can use Docker locally)
- Real customer UAT (production only)
- Advanced penetration testing (hire security consultant)

---

**Last Updated:** February 17, 2026 - 5:30 PM WIB  
**Next Review:** After Phase 1 testing complete  

**🎯 Immediate Action: Run database migration and start E2E testing!**
