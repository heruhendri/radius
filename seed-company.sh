#!/bin/bash
mysql -h 127.0.0.1 -u salfanet_user -psalfanetradius123 salfanet_radius << 'ENDSQL'
INSERT INTO companies (id, name, email, phone, address, adminPhone, baseUrl, footerAdmin, footerCustomer, footerTechnician, footerAgent, updatedAt) 
VALUES (
  'default', 
  'SALFANET RADIUS', 
  'admin@salfanet.com', 
  '+62 812-3456-7890', 
  'Jakarta, Indonesia', 
  '+62 812-3456-7890', 
  'http://192.168.54.200', 
  'Powered by SALFANET RADIUS', 
  'Powered by SALFANET RADIUS', 
  'Powered by SALFANET RADIUS', 
  'Powered by SALFANET RADIUS', 
  NOW()
);
ENDSQL
echo "Exit: $?"
