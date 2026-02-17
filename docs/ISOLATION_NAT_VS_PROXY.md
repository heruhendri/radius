# Isolation System: NAT Redirect vs Web Proxy vs Hotspot

**Date**: February 2, 2026  
**Type**: Technical Comparison & Implementation Guide

---

## 🔍 Overview: Metode yang Digunakan

**Salfanet Radius menggunakan**: **Firewall NAT Redirect** + **Halaman Isolir Next.js**

**BUKAN**: Web Proxy atau Hotspot

---

## 📋 Perbandingan 3 Metode Isolasi

### Method 1: Web Proxy (❌ Tidak Dipakai)

**Cara Kerja**:
```routeros
/ip proxy
set enabled=yes port=8080

/ip proxy access
add dst-host=google.com action=deny \
    redirect-to=http://billing.domain.com/isolated
```

**Kelebihan**:
- ✅ Setup simple
- ✅ Built-in di MikroTik

**Kekurangan**:
- ❌ Hanya bisa HTTP (port 80), tidak support HTTPS
- ❌ Perlu configure browser proxy (tidak transparent)
- ❌ Performance rendah untuk banyak user
- ❌ Limited customization
- ❌ Tidak bisa intercept HTTPS tanpa certificate install

**Verdict**: ❌ **Tidak cocok untuk ISP modern**

---

### Method 2: Hotspot (❌ Tidak Dipakai)

**Cara Kerja**:
```routeros
/ip hotspot
add interface=bridge-local \
    address-pool=pool-isolir \
    profile=isolated-profile

/ip hotspot profile
set isolated-profile \
    html-directory=flash/hotspot/isolated \
    login-by=http-chap
```

**Kelebihan**:
- ✅ Built-in login page
- ✅ User management terintegrasi
- ✅ Walled garden untuk allow specific sites

**Kekurangan**:
- ❌ User harus login ulang via hotspot
- ❌ Kompleks setup (profile, server, walled garden)
- ❌ HTML page static (tidak bisa dynamic dari database)
- ❌ Tidak terintegrasi dengan Next.js app
- ❌ Butuh cookie/session management tersendiri

**Verdict**: ❌ **Tidak cocok untuk PPPoE isolated users**

---

### Method 3: Firewall NAT Redirect (✅ DIPAKAI)

**Cara Kerja**:
```routeros
# Step 1: User isolated dapat IP dari pool isolir
/ip pool
add name=pool-isolir ranges=192.168.200.2-192.168.200.254

/ppp profile
add name=isolir local-address=pool-isolir remote-address=pool-isolir

# Step 2: Firewall allow DNS + billing server + payment gateway
/ip firewall filter
add chain=forward src-address=192.168.200.0/24 \
    protocol=udp dst-port=53 action=accept comment="Allow DNS"
    
add chain=forward src-address=192.168.200.0/24 \
    dst-address=103.xxx.xxx.xxx action=accept comment="Allow billing"
    
add chain=forward src-address=192.168.200.0/24 \
    dst-address-list=payment-gateways action=accept comment="Allow payment"
    
add chain=forward src-address=192.168.200.0/24 \
    action=drop comment="Block all other internet"

# Step 3: Redirect HTTP/HTTPS ke billing server
/ip firewall nat
add chain=dstnat src-address=192.168.200.0/24 \
    protocol=tcp dst-port=80 \
    dst-address=!103.xxx.xxx.xxx \
    dst-address-list=!payment-gateways \
    action=dst-nat to-addresses=103.xxx.xxx.xxx to-ports=80

add chain=dstnat src-address=192.168.200.0/24 \
    protocol=tcp dst-port=443 \
    dst-address=!103.xxx.xxx.xxx \
    dst-address-list=!payment-gateways \
    action=dst-nat to-addresses=103.xxx.xxx.xxx to-ports=443
```

**Kelebihan**:
- ✅ **Transparent**: User tidak perlu action apapun
- ✅ **Support HTTP & HTTPS**: Redirect both ports
- ✅ **Integrated**: Langsung ke Next.js app (database, payment, etc.)
- ✅ **Dynamic**: Halaman isolir bisa fetch data real-time dari API
- ✅ **Professional**: Custom UI/UX dengan React components
- ✅ **Payment Ready**: Direct integration dengan Midtrans/Xendit/Duitku
- ✅ **No Extra Login**: User sudah authenticated via PPPoE
- ✅ **Scalable**: Server handle logic, MikroTik cuma redirect

**Kekurangan**:
- ⚠️ Butuh web server external (Next.js app)
- ⚠️ Perlu setup firewall rules dengan benar

**Verdict**: ✅ **BEST untuk production ISP!**

---

## 🔧 Implementation Detail: NAT Redirect

### User Journey

```
┌──────────────────────────────────────────────────────┐
│  1. USER EXPIRED & AUTO-ISOLATED                     │
│     - Cron job (hourly): autoIsolatePPPoEUsers()    │
│     - UPDATE pppoe_users SET status = 'ISOLATED'    │
│     - radusergroup → 'isolir'                       │
│     - CoA disconnect → force re-auth                │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  2. USER RE-LOGIN VIA PPPoE                          │
│     - FreeRADIUS Auth:                               │
│       • Username: user123                            │
│       • Password: ✅ Accept (password valid)        │
│       • radusergroup: 'isolir'                      │
│     - RADIUS Reply:                                  │
│       • Framed-IP-Address: pool-isolir              │
│       • Mikrotik-Address-Pool: pool-isolir          │
│       • Mikrotik-Rate-Limit: 64k/64k               │
│     - MikroTik assigns: 192.168.200.50              │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  3. USER BROWSING (TRANSPARENT REDIRECT)             │
│                                                       │
│  User opens browser: http://google.com               │
│                                                       │
│  MikroTik Firewall NAT:                              │
│  ┌────────────────────────────────────────────────┐ │
│  │ Match:                                         │ │
│  │ - src-address = 192.168.200.50 ✅             │ │
│  │ - protocol = tcp ✅                           │ │
│  │ - dst-port = 80 ✅                            │ │
│  │ - dst-address != 103.xxx.xxx.xxx ✅           │ │
│  │                                                 │ │
│  │ Action: dst-nat                                │ │
│  │ - to-addresses = 103.xxx.xxx.xxx              │ │
│  │ - to-ports = 80                                │ │
│  └────────────────────────────────────────────────┘ │
│                                                       │
│  Result: HTTP request redirected to billing server   │
│  URL in browser: http://google.com (tidak berubah)  │
│  Actual destination: http://103.xxx.xxx.xxx/        │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  4. NEXT.JS APP DETECTION (2 Options)                │
│                                                       │
│  Option A: Auto-detect Source IP (Recommended)       │
│  ┌────────────────────────────────────────────────┐ │
│  │ middleware.ts                                  │ │
│  │ ┌────────────────────────────────────────────┐ │ │
│  │ │ const sourceIp = req.headers['x-real-ip'] │ │ │
│  │ │ if (sourceIp.startsWith('192.168.200.')) { │ │ │
│  │ │   return redirect('/isolated?username=X')  │ │ │
│  │ │ }                                           │ │ │
│  │ └────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────┘ │
│                                                       │
│  Option B: Manual URL (Current)                      │
│  User directly access:                               │
│  http://billing.domain.com/isolated?username=user123 │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  5. DISPLAY ISOLATION PAGE                           │
│     File: src/app/isolated/page.tsx                  │
│                                                       │
│     Content:                                          │
│     ┌──────────────────────────────────────────────┐│
│     │ 🚫 Layanan Internet Anda Diisolir           ││
│     │                                               ││
│     │ 👤 Username: user123                         ││
│     │ 📞 Phone: 081234567890                       ││
│     │ 📅 Expired: 2026-02-01                       ││
│     │                                               ││
│     │ 📋 Tagihan Belum Dibayar:                    ││
│     │ ┌───────────────────────────────────────────┐││
│     │ │ INV-2026-001     Rp 200,000              │││
│     │ │ Jatuh Tempo: 2026-02-01                  │││
│     │ │ [ Bayar Sekarang ]                       │││
│     │ └───────────────────────────────────────────┘││
│     │                                               ││
│     │ 💬 Hubungi Kami:                             ││
│     │ [ WhatsApp ]  [ Email ]                     ││
│     └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  6. USER CLICK "BAYAR SEKARANG"                      │
│     Redirect: /pay/<paymentToken>                    │
│                                                       │
│     MikroTik allows:                                 │
│     - dst-address = 103.xxx.xxx.xxx ✅              │
│     (billing server not redirected)                  │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  7. PAYMENT PAGE                                      │
│     File: src/app/pay/[token]/page.tsx               │
│                                                       │
│     Content:                                          │
│     - Invoice details                                │
│     - Payment gateway selection:                     │
│       [ ] Midtrans (QRIS, VA, E-Wallet)             │
│       [ ] Xendit (QRIS, VA, E-Wallet)               │
│       [ ] Duitku (QRIS, VA, E-Wallet)               │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  8. REDIRECT TO PAYMENT GATEWAY                      │
│     URL: https://app.midtrans.com/snap/v3/...       │
│                                                       │
│     MikroTik allows:                                 │
│     - dst-address-list = payment-gateways ✅        │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  9. USER COMPLETES PAYMENT                           │
│     - Scan QRIS / Input VA / Login E-Wallet         │
│     - Confirm payment                                │
│     - Payment gateway processes                      │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│  10. WEBHOOK → AUTO-RESTORE                          │
│      POST /api/webhooks/midtrans                     │
│      → UPDATE invoice SET status = 'PAID'           │
│      → Cron (5 min): auto-renewal                   │
│      → UPDATE user SET status = 'ACTIVE'            │
│      → CoA disconnect → force re-auth               │
│      → User gets normal IP + full internet ✅       │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 Technical Comparison

### Traffic Flow Analysis

**Method 1: Web Proxy**
```
User → Browser (manual proxy config) → MikroTik Proxy:8080 → Redirect
❌ Not transparent, HTTP only
```

**Method 2: Hotspot**
```
User → Any website → MikroTik intercept → Hotspot login page → Allow after login
❌ Requires login, complex for isolated users
```

**Method 3: NAT Redirect (Current)**
```
User → Any website → MikroTik NAT redirect → Billing server → Dynamic page
✅ Transparent, both HTTP/HTTPS, integrated with app
```

---

## 💡 Enhancement: Auto-detect Isolated IP

**Current Implementation**: User manually access `/isolated?username=X`

**Better Implementation**: Auto-redirect based on source IP

### Create Middleware for Auto-detection

```typescript
// src/middleware.ts (NEW FILE)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function middleware(request: NextRequest) {
  // Get source IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const sourceIp = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  
  console.log('[MIDDLEWARE] Source IP:', sourceIp);
  
  // Check if IP is from isolated pool (192.168.200.x)
  if (sourceIp.startsWith('192.168.200.')) {
    const currentPath = request.nextUrl.pathname;
    
    // Don't redirect if already on isolated pages or API routes
    if (
      currentPath.startsWith('/isolated') ||
      currentPath.startsWith('/pay') ||
      currentPath.startsWith('/api') ||
      currentPath.startsWith('/_next') ||
      currentPath.includes('.')
    ) {
      return NextResponse.next();
    }
    
    // Try to find username from active PPPoE session
    try {
      // Query radacct to find active username with this IP
      const session = await prisma.radacct.findFirst({
        where: {
          framedipaddress: sourceIp,
          acctstoptime: null,
        },
        select: { username: true },
        orderBy: { acctstarttime: 'desc' },
      });
      
      if (session?.username) {
        // Redirect to isolated page with username
        const url = request.nextUrl.clone();
        url.pathname = '/isolated';
        url.searchParams.set('username', session.username);
        
        console.log('[MIDDLEWARE] Redirecting to:', url.toString());
        return NextResponse.redirect(url);
      }
    } catch (err) {
      console.error('[MIDDLEWARE] Error querying radacct:', err);
    }
    
    // Fallback: redirect without username
    const url = request.nextUrl.clone();
    url.pathname = '/isolated';
    url.searchParams.set('ip', sourceIp);
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
```

### Update Nginx/Traefik to Pass Real IP

**Nginx**:
```nginx
server {
    listen 80;
    server_name billing.domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Traefik** (docker-compose.yml):
```yaml
services:
  salfanet-radius:
    labels:
      - "traefik.http.middlewares.real-ip.headers.customrequestheaders.X-Real-IP=$$REMOTE_ADDR"
      - "traefik.http.routers.billing.middlewares=real-ip"
```

---

## 🔐 Security Considerations

### 1. Prevent Bypass via HTTPS Certificate Error

**Problem**: User bisa bypass redirect dengan accept certificate error

**Solution**: Firewall NAT untuk HTTPS harus konsisten:
```routeros
# HTTPS redirect (443)
/ip firewall nat
add chain=dstnat src-address=192.168.200.0/24 \
    protocol=tcp dst-port=443 \
    dst-address=!103.xxx.xxx.xxx \
    dst-address-list=!payment-gateways \
    action=dst-nat to-addresses=103.xxx.xxx.xxx to-ports=443
```

### 2. Prevent DNS Hijacking

**Allow only specific DNS servers**:
```routeros
/ip firewall filter
add chain=forward src-address=192.168.200.0/24 \
    protocol=udp dst-port=53 \
    dst-address=8.8.8.8 action=accept

add chain=forward src-address=192.168.200.0/24 \
    protocol=udp dst-port=53 \
    dst-address=1.1.1.1 action=accept
    
add chain=forward src-address=192.168.200.0/24 \
    protocol=udp dst-port=53 \
    action=drop comment="Block other DNS"
```

### 3. Rate Limit Isolated Users

```routeros
/ppp profile
set isolir rate-limit=64k/64k
```

Prevent abuse of payment server bandwidth.

---

## 📊 Performance Comparison

| Metric | Web Proxy | Hotspot | NAT Redirect |
|--------|-----------|---------|--------------|
| CPU Usage | High | Medium | Low |
| Memory | Medium | Medium | Low |
| Throughput | ~100 users | ~500 users | ~2000+ users |
| Latency | +50ms | +20ms | +2ms |
| Support HTTPS | ❌ | ✅ | ✅ |
| Transparent | ❌ | ❌ | ✅ |
| Custom Page | ❌ | Limited | Full control |

**Winner**: 🏆 **NAT Redirect**

---

## ✅ Summary

### What Salfanet Radius Uses

```
✅ Firewall NAT Redirect
✅ Halaman Isolir Next.js (/isolated)
✅ Payment Integration (Midtrans/Xendit/Duitku)
✅ Auto-restore via cron

❌ TIDAK pakai Web Proxy
❌ TIDAK pakai Hotspot
```

### Why It's Better

1. **Transparent**: User tidak perlu action, langsung kena redirect
2. **Modern**: Full control atas UI/UX dengan React
3. **Integrated**: Direct access ke database & payment gateway
4. **Scalable**: MikroTik hanya redirect, logic di server
5. **Professional**: Dynamic content, real-time data

### Workflow

```
Isolated User → Browse Web → NAT Redirect → /isolated Page 
                → Payment → Webhook → Auto-restore ✅
```

---

**End of Document**

*Last Updated: February 2, 2026*
