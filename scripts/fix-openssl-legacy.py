#!/usr/bin/env python3
"""Enable OpenSSL legacy provider for MD4 (required by FreeRADIUS MS-CHAP)"""
import re

path = '/usr/lib/ssl/openssl.cnf'
with open(path, 'r') as f:
    content = f.read()

# Add legacy = legacy_sect after default = default_sect
content = content.replace(
    '[provider_sect]\ndefault = default_sect',
    '[provider_sect]\ndefault = default_sect\nlegacy = legacy_sect'
)

# Activate default and add legacy_sect
content = content.replace(
    '[default_sect]\n# activate = 1',
    '[default_sect]\nactivate = 1\n\n[legacy_sect]\nactivate = 1'
)

with open(path, 'w') as f:
    f.write(content)
print('OpenSSL legacy provider enabled successfully')
