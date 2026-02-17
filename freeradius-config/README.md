# FreeRADIUS Configuration Files

**Updated:** December 31, 2025 (from production VPS 192.168.54.200)

## Configuration Overview

These files are synchronized from the running production FreeRADIUS server on VPS.

### ⚠️ IMPORTANT: MS-CHAP Authentication Fix

**For Ubuntu 22.04 with OpenSSL 3.0+**, you MUST enable the legacy provider for MS-CHAP to work:

```bash
# Edit /etc/ssl/openssl.cnf
# In [provider_sect], add:
legacy = legacy_sect

# Add new section:
[legacy_sect]
activate = 1

# Restart FreeRADIUS
systemctl restart freeradius
```

**Also ensure Auth-Type uses lowercase 'mschap':**
```
authenticate {
    Auth-Type mschap {   # lowercase, NOT MS-CHAP
        mschap
    }
}
```

### Files Included

1. **clients.conf** - RADIUS client (NAS) definitions
   - Contains example static NAS entries (commented out)
   - RADIUS clients are primarily stored in database table `nas`
   - See `mods-available/sql` for `read_clients = yes` configuration

2. **mods-available/sql** - MySQL/MariaDB database configuration
   - Database: salfanet_radius
   - Connection pooling: min=4, max=10, start=5
   - SQL query definitions for authentication and accounting
   - **read_clients = yes** - Reads NAS clients from database
   - **client_table = "nas"** - Database table for RADIUS clients

3. **sites-available/default** - Main RADIUS virtual server
   - Authentication flow (authorize, authenticate)
   - **Auth-Type mschap** - Lowercase for FreeRADIUS 3.x compatibility
   - Accounting flow (preacct, accounting)
   - Post-auth processing
   - Listen on port 1812 (auth) and 1813 (acct)

4. **sites-available/coa** - CoA (Change of Authorization) server
   - **Listen on port 3799** for CoA and Disconnect-Request
   - Used for real-time user session termination
   - Supports voucher expiration auto-disconnect
   - Works with Mikrotik CoA client configuration

5. **policy.d/filter** - Policy filters
   - MAC address filtering
   - Username validation
   - Custom access control rules

### Symbolic Links (Linux)

On the VPS, these files use symbolic links:
```bash
# SQL module
ln -s /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql

# Default site
ln -s /etc/freeradius/3.0/sites-available/default /etc/freeradius/3.0/sites-enabled/default

# CoA site (IMPORTANT!)
ln -s /etc/freeradius/3.0/sites-available/coa /etc/freeradius/3.0/sites-enabled/coa
```

### Installation Notes

1. These configs are for **FreeRADIUS 3.0**
2. Update database credentials in `mods-available/sql`
3. RADIUS clients are managed in database, NOT in clients.conf
4. Enable CoA site: `ln -s ../sites-available/coa sites-enabled/coa`
5. Test configuration: `freeradius -CX`
6. Restart service: `systemctl restart freeradius`

### CoA Configuration

The server listens for CoA (Change of Authorization) on port **3799** for:
- **Disconnect-Request** - Terminate user sessions (voucher expiration)
- **CoA-Request** - Change user attributes (speed limit, etc)

**How it works:**
1. Application sends CoA packet to FreeRADIUS (port 3799)
2. FreeRADIUS validates request using shared secret
3. FreeRADIUS disconnects session in Mikrotik NAS
4. Mikrotik terminates user session immediately

### Database NAS Table

RADIUS clients are stored in MySQL database:
```sql
SELECT id, name, nasname, ipAddress, secret FROM nas;
```

Example:
```
id                                      name     nasname       ipAddress     secret
71291ead-2b12-402c-aeb0-5bea3cacdc66    gateway  172.20.30.1   172.20.30.1   secret123
b44a4c34-14c3-42a7-8b7d-b2bd423d9b1b    test     172.20.30.11  172.20.30.11  secret123
```

**Important:** Keep RADIUS clients in database, NOT in clients.conf!

### Important Security Notes

- Keep `clients.conf` secret (contains RADIUS shared secrets)
- Use strong, unique secrets for each NAS
- Restrict database access to localhost only
- Monitor failed authentication attempts

### Timezone Configuration

FreeRADIUS uses system timezone (Asia/Jakarta / WIB):
```bash
timedatectl set-timezone Asia/Jakarta
```

MySQL must also use matching timezone:
```sql
SET GLOBAL time_zone = '+07:00';
```

## Troubleshooting

**Debug mode:**
```bash
systemctl stop freeradius
freeradius -X
```

**Test authentication:**
```bash
radtest username password localhost 0 testing123
```

**Test CoA disconnect:**
```bash
echo "User-Name = test" | radclient -x 127.0.0.1:3799 disconnect testing123
```

## Production Configuration

This configuration is actively used in production and has been tested with:
- ✅ Mikrotik RouterOS (CHR and hardware)
- ✅ PPPoE authentication
- ✅ Hotspot voucher system
- ✅ Session accounting
- ✅ CoA disconnect (real-time user termination)
- ✅ L2TP VPN tunnel (172.20.30.x network)
