# 📱 Mobile Testing Guide

Guide untuk testing aplikasi di HP - dengan atau tanpa ngrok.

## 🚀 Option 1: Same WiFi (Tercepat & Gratis)

### Cara Paling Mudah - Tanpa Setup Apapun!

**Langkah:**

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **Lihat Network URL**
   Next.js akan menampilkan:
   ```
   ▲ Next.js 16.0.8
   - Local:    http://localhost:3000
   - Network:  http://192.168.1.10:3000  ← Copy URL ini!
   ```

3. **Akses dari HP**
   - Pastikan HP dan PC di WiFi yang sama
   - Buka browser di HP
   - Ketik URL Network (contoh: `http://192.168.1.10:3000`)
   - ✅ Langsung bisa test!

**Keuntungan:**
- ✅ Gratis, no setup needed
- ✅ Cepat, no tunnel overhead
- ✅ Unlimited session
- ✅ No internet required

**Kekurangan:**
- ❌ HP harus di WiFi yang sama
- ❌ Tidak bisa share ke remote tester

---

## 🌐 Option 2: Ngrok Tunnel (Remote Access)

Gunakan jika butuh akses dari HP yang tidak di WiFi yang sama.

### Setup Ngrok (One-time)

1. **Sign Up Ngrok** (Gratis)
   - Kunjungi: https://dashboard.ngrok.com/signup
   - Sign up dengan email/Google/GitHub

2. **Get Authtoken**
   - Login ke: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy authtoken Anda

3. **Install Authtoken**
   ```bash
   npx ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

### Cara Pakai

1. **Start Dev Server** (Terminal 1)
   ```bash
   npm run dev
   ```

2. **Start Ngrok** (Terminal 2)
   ```bash
   npm run tunnel
   ```

3. **Copy URL & Test**
   - Lihat "Forwarding" line
   - Copy URL `https://xxxx.ngrok-free.app`
   - Buka di HP (bisa WiFi apapun/mobile data)

**Keuntungan:**
- ✅ Akses dari mana saja (no same WiFi needed)
- ✅ Share URL ke tim untuk testing
- ✅ Test dengan mobile data

**Kekurangan:**
- ❌ Perlu setup auth (sekali saja)
- ❌ Free tier: 2 jam session limit
- ❌ Sedikit lebih lambat (tunnel overhead)

---

## 📋 Quick Comparison

| Feature | Same WiFi | Ngrok Tunnel |
|---------|-----------|--------------|
| Setup | ✅ No setup | ⚠️ One-time auth |
| Speed | ⚡ Fastest | 🔄 Normal |
| Duration | ♾️ Unlimited | ⏱️ 2 hours |
| Remote Access | ❌ No | ✅ Yes |
| Share to Team | ❌ No | ✅ Yes |
| Cost | 🆓 Free | 🆓 Free (limited) |

---

## 🎯 Recommended Workflow

### For Quick Testing (Recommended)
```bash
# 1. Start dev server
npm run dev

# 2. Check Network URL (ditampilkan di terminal)
- Network:  http://192.168.1.10:3000

# 3. Open di HP (sambungkan ke WiFi yang sama)
http://192.168.1.10:3000
```

### For Remote Testing
```bash
# 1. Start dev server
npm run dev

# 2. (Terminal baru) Start tunnel
npm run tunnel

# 3. Share URL ke siapa saja
https://abc123.ngrok-free.app
```

## 🎨 Testing Checklist

### Mobile Sidebar
- [ ] Sidebar slides from left smoothly
- [ ] Menu items readable (mixed case, not uppercase)
- [ ] Scroll ke bawah untuk logout tidak auto-close
- [ ] Tap overlay to close works
- [ ] Logout button accessible

### Forms
- [ ] Input fields focus properly
- [ ] Mobile keyboard doesn't overlap fields
- [ ] Date pickers work on mobile
- [ ] Dropdowns scrollable

### Navigation
- [ ] Bottom nav (customer app) accessible
- [ ] Touch targets minimum 44px
- [ ] Swipe gestures work

### Performance
- [ ] Page loads in < 3s
- [ ] Smooth scrolling
- [ ] No layout shift (CLS)

## 💡 Tips

1. **Chrome DevTools Mobile View** untuk quick check, **ngrok tunnel** untuk real device testing
2. **Enable Mobile Data** di HP untuk test dari internet asli (bukan WiFi)
3. **Take Screenshots** untuk dokumentasi bugs
4. **Test Different Orientations** (portrait & landscape)
5. **Test Slow 3G** di Chrome DevTools untuk simulate poor connection

## 🔗 Useful Links

- [Ngrok Dashboard](https://dashboard.ngrok.com/)
- [Ngrok Documentation](https://ngrok.com/docs)
- [Next.js Preview Mode](https://nextjs.org/docs/advanced-features/preview-mode)

## 📝 Example Workflow

```bash
# Terminal 1: Dev server
npm run dev
# Wait for "Ready in XXXms"

# Terminal 2: Ngrok tunnel
npm run tunnel
# Copy the https URL

# Browser/HP: Open URL
https://abc123.ngrok-free.app

# Test features:
- Login sebagai admin
- Open sidebar
- Scroll to bottom
- Klik logout
- Verify sidebar tidak auto-close saat scroll
```

## 🎯 Next Steps

Setelah testing mobile:
1. Fix bugs yang ditemukan
2. Screenshot untuk dokumentasi
3. Update UI based on feedback
4. Test di multiple devices/browsers
5. Deploy ke production

---

**Happy Mobile Testing! 🚀📱**
