#!/usr/bin/env python3
import re

with open('/etc/nginx/sites-enabled/salfanet-radius', 'r') as f:
    content = f.read()

# Remove the broken inserted blocks (from the first direct-Next.js comment to just before "# API routes -> Go")
broken_pattern = r'\n    # Routes handled directly by Next\.js.*?(?=    # API routes -> Go)'
content = re.sub(broken_pattern, '\n', content, flags=re.DOTALL)

# Now insert correct blocks before "# API routes -> Go"
nextjs_direct = '''
    # Routes handled directly by Next.js (Prisma DB / file upload) - no Go intercept
    location ~ ^/api/backup/(restore|create|telegram|download) {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   CF-Connecting-IP $http_cf_connecting_ip;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_hide_header  X-Frame-Options;
        proxy_hide_header  X-XSS-Protection;
        proxy_hide_header  X-Content-Type-Options;
    }

    location ~ ^/api/settings/(isolation|email|notification|whatsapp) {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   CF-Connecting-IP $http_cf_connecting_ip;
        proxy_hide_header  X-Frame-Options;
        proxy_hide_header  X-XSS-Protection;
        proxy_hide_header  X-Content-Type-Options;
    }

'''

marker = '    # API routes -> Go'
if marker in content:
    content = content.replace(marker, nextjs_direct + marker, 1)
    with open('/etc/nginx/sites-enabled/salfanet-radius', 'w') as f:
        f.write(content)
    print('OK: config updated')
else:
    print('ERROR: marker not found in block 1')
    # Try alternate marker
    marker2 = '    location /api/ {'
    if marker2 in content:
        content = content.replace(marker2, nextjs_direct.rstrip('\n') + '\n\n' + marker2, 1)
        with open('/etc/nginx/sites-enabled/salfanet-radius', 'w') as f:
            f.write(content)
        print('OK: config updated via alternate marker')
    else:
        print('FAIL: cannot find insertion point')
