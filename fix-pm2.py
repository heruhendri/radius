content = open('/var/www/salfanet-radius/ecosystem.config.js').read()
content = content.replace("max_memory_restart: '370M'", "max_memory_restart: '600M'", 1)
open('/var/www/salfanet-radius/ecosystem.config.js', 'w').write(content)
print('done')
