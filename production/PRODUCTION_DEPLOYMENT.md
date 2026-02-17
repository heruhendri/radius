# Production Deployment Checklist

## Pre-Deployment Checklist

### ✅ Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Set strong `NEXTAUTH_SECRET` (min 32 chars)
  ```bash
  openssl rand -base64 32
  ```
- [ ] Configure `DATABASE_URL` with production credentials
- [ ] Set `NODE_ENV=production`
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Configure `RADIUS_SERVER_IP` / `VPS_IP`
- [ ] Setup payment gateway keys (Midtrans/Xendit)
- [ ] Configure WhatsApp/Telegram credentials (optional)
- [ ] Set timezone to `Asia/Jakarta`

### ✅ Database Setup
- [ ] Create production database
  ```sql
  CREATE DATABASE salfanet_radius CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```
- [ ] Run migrations
  ```bash
  npx prisma db push
  npx prisma generate
  ```
- [ ] Seed initial data
  ```bash
  npx tsx prisma/seeds/seed-all.ts
  ```
- [ ] Backup database credentials securely

### ✅ Security Hardening
- [ ] Run security audit
  ```bash
  bash security-audit.sh
  ```
- [ ] Ensure `.env` is in `.gitignore`
- [ ] Remove all `console.log` from critical code
- [ ] Verify all API routes have authentication
- [ ] Set file permissions on `.env` (chmod 600)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Change default admin password

### ✅ Code Cleanup
- [ ] Run production cleanup
  ```bash
  # Windows
  .\cleanup-production.bat
  
  # Linux/Mac
  bash cleanup-production.sh
  ```
- [ ] Remove development files
- [ ] Check for hardcoded secrets
- [ ] Optimize images in `/public`
- [ ] Remove unused dependencies
  ```bash
  npm prune --production
  ```

### ✅ Build & Test
- [ ] Test build locally
  ```bash
  npm run build
  ```
- [ ] Fix all TypeScript errors
- [ ] Fix all ESLint warnings
- [ ] Run API tests
  ```bash
  npm run test:api
  ```
- [ ] Test in production mode locally
  ```bash
  npm run build
  npm start
  ```

### ✅ Server Configuration
- [ ] Install Node.js (v18 or higher)
- [ ] Install PM2 globally
  ```bash
  npm install -g pm2
  ```
- [ ] Configure MySQL/MariaDB
- [ ] Install FreeRADIUS (if using RADIUS)
- [ ] Setup Nginx reverse proxy
- [ ] Configure SSL certificate (Let's Encrypt)
- [ ] Setup firewall (UFW/iptables)

### ✅ Deployment
- [ ] Clone repository to server
  ```bash
  git clone <repo-url>
  cd salfanet-radius-main
  ```
- [ ] Install dependencies
  ```bash
  npm ci --production
  ```
- [ ] Build application
  ```bash
  npm run build
  ```
- [ ] Start with PM2
  ```bash
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup
  ```
- [ ] Configure Nginx
- [ ] Test all endpoints
- [ ] Monitor logs
  ```bash
  pm2 logs salfanet-radius
  ```

### ✅ Post-Deployment
- [ ] Verify application is running
- [ ] Test login with admin credentials
- [ ] Check database connectivity
- [ ] Test API endpoints
- [ ] Verify RADIUS authentication (if applicable)
- [ ] Test payment gateway integration
- [ ] Setup monitoring (PM2, logs)
- [ ] Configure automated backups
  ```bash
  # Daily database backup
  0 2 * * * mysqldump -u root salfanet_radius > /backup/db_$(date +\%Y\%m\%d).sql
  ```
- [ ] Setup SSL renewal automation
- [ ] Document any custom configurations

## Quick Deploy Commands

### First Time Deployment
```bash
# 1. Setup environment
cp .env.example .env
nano .env  # Edit configuration

# 2. Install & Build
npm ci --production
npm run build

# 3. Database
npx prisma db push
npx prisma generate
npx tsx prisma/seeds/seed-all.ts

# 4. Start
pm2 start ecosystem.config.js
pm2 save
```

### Update Deployment
```bash
# Pull latest changes
git pull

# Install dependencies (if package.json changed)
npm ci --production

# Database migration (if schema changed)
npx prisma db push
npx prisma generate

# Build
npm run build

# Restart
pm2 restart salfanet-radius
```

## Rollback Procedure

If deployment fails:

```bash
# 1. Restore previous version
git checkout <previous-commit>

# 2. Rebuild
npm run build

# 3. Restart
pm2 restart salfanet-radius

# 4. Restore database (if needed)
mysql -u root salfanet_radius < /backup/db_latest.sql
```

## Monitoring & Maintenance

### Check Application Status
```bash
pm2 status
pm2 logs salfanet-radius
```

### View Metrics
```bash
pm2 monit
```

### Restart Application
```bash
pm2 restart salfanet-radius
```

### Clear Logs
```bash
pm2 flush
```

### Database Backup
```bash
# Manual backup
mysqldump -u root -p salfanet_radius > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p salfanet_radius < backup_20260118.sql
```

## Troubleshooting

### Application won't start
1. Check logs: `pm2 logs`
2. Verify `.env` configuration
3. Check database connection
4. Ensure port 3000 is available

### Database connection errors
1. Verify MySQL is running
2. Check `DATABASE_URL` in `.env`
3. Test connection: `mysql -u root -p`
4. Verify database exists

### Build errors
1. Clear cache: `rm -rf .next node_modules`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`

### Performance issues
1. Check PM2 metrics: `pm2 monit`
2. Increase memory limit in `ecosystem.config.js`
3. Optimize database queries
4. Enable caching

## Security Checklist

- [ ] Firewall configured (ports 80, 443, 3306 only)
- [ ] SSH key authentication only
- [ ] Fail2ban installed
- [ ] Automatic security updates enabled
- [ ] Database not exposed to public
- [ ] Strong passwords everywhere
- [ ] SSL certificate valid
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Regular backups automated

## Default Credentials

**⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN**

- Username: `superadmin`
- Password: `admin123`

## Support

For issues or questions:
- Check documentation: `/docs`
- Review logs: `pm2 logs`
- GitHub Issues: [repository]

---

**Last Updated:** January 2026
