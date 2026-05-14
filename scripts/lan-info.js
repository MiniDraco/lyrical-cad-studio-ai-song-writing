#!/usr/bin/env node
const os = require('os');

const PORT = process.env.PORT || 4000;
const ifaces = os.networkInterfaces();
const addrs = [];

for (const name of Object.keys(ifaces)) {
  for (const net of ifaces[name] || []) {
    if (net.family === 'IPv4' && !net.internal) {
      addrs.push({ name, address: net.address });
    }
  }
}

console.log('');
console.log('LAN addresses for this machine:');
console.log('');
if (addrs.length === 0) {
  console.log('  (no non-loopback IPv4 interfaces found — are you connected to a network?)');
} else {
  for (const a of addrs) {
    console.log(`  http://${a.address}:${PORT}   [${a.name}]`);
  }
}
console.log('');
console.log('On your phone (same Wi-Fi), open one of the URLs above.');
console.log('If it does not load:');
console.log('  1. Make sure "npm run dev" is running on this PC.');
console.log('  2. Allow Node.js through Windows Firewall (Private networks).');
console.log('     Run "npm run firewall:open" from an elevated PowerShell once.');
console.log('  3. Your Wi-Fi profile must be set to "Private", not "Public".');
console.log('');
