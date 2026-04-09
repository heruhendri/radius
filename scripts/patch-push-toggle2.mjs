import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/app/technician/TechnicianPortalLayout.tsx', 'utf8');

// 1. BellOff import (file uses CRLF)
c = c.replace('  Bell,\r\n  Cpu,', '  Bell,\r\n  BellOff,\r\n  Cpu,');
console.log('BellOff in imports:', c.includes('BellOff,\r\n  Cpu,'));

// 2. Find the logout button in TechSidebar and insert SidebarPushToggle before it
// The logout button starts with:  <button\n            onClick={onLogout}
const searchStr = '          <button\r\n            onClick={onLogout}';
const replaceStr = '          {tech && <SidebarPushToggle techId={tech.id} />}\r\n          <button\r\n            onClick={onLogout}';

if (c.includes(searchStr)) {
  c = c.replace(searchStr, replaceStr);
  console.log('Sidebar toggle added');
} else {
  // Try to find the logout button another way
  const idx = c.indexOf('onClick={onLogout}');
  console.log('onLogout index:', idx);
  console.log('Context around it:');
  // Find the start of the <button tag before onLogout
  const before = c.lastIndexOf('<button\r\n', idx);
  const before2 = c.lastIndexOf('<button\n', idx);
  console.log('button before (CRLF):', before, 'button before (LF):', before2);
}

console.log('SidebarPushToggle in sidebar:', c.includes('SidebarPushToggle techId'));
writeFileSync('src/app/technician/TechnicianPortalLayout.tsx', c, 'utf8');
console.log('Done. Length:', c.length);
