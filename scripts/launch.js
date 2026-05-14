#!/usr/bin/env node
// Spawns `next dev -H 0.0.0.0`, streams its output, and re-prints the LAN
// URLs in a banner once Next is Ready — so the address your phone needs is
// the LAST thing on screen, not buried in startup logs.

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

// Default we *try* to use, but if Next picks a different one (because the
// port is taken or the user overrides via `next dev -p NNNN`), we update
// `actualPort` from Next's own startup line so the banner stays correct.
const DEFAULT_PORT = process.env.PORT || 4000;
let actualPort = DEFAULT_PORT;

function lanAddresses() {
  const ifaces = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        out.push({ name, address: net.address });
      }
    }
  }
  return out;
}

function pickPrimary(addrs) {
  // Prefer 192.168.x.x or 10.x.x.x — typical home Wi-Fi.
  // Push 192.168.56.x (VirtualBox host-only) and 172.16-31.x (Docker/WSL) to the back.
  const score = (a) => {
    if (a.address.startsWith('192.168.56.')) return 3;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(a.address)) return 3;
    if (a.address.startsWith('192.168.')) return 0;
    if (a.address.startsWith('10.')) return 1;
    return 2;
  };
  return [...addrs].sort((a, b) => score(a) - score(b))[0];
}

function banner() {
  const addrs = lanAddresses();
  const lines = [];
  const bar = '='.repeat(60);
  lines.push('');
  lines.push(bar);
  lines.push('  Open this on your phone (same Wi-Fi):');
  lines.push('');
  if (addrs.length === 0) {
    lines.push('  (no LAN interfaces detected - is Wi-Fi/Ethernet connected?)');
  } else {
    const primary = pickPrimary(addrs);
    lines.push(`    >>  http://${primary.address}:${actualPort}  <<   [${primary.name}]`);
    const others = addrs.filter((a) => a.address !== primary.address);
    if (others.length) {
      lines.push('');
      lines.push('  Other interfaces (try these only if the one above fails):');
      for (const a of others) {
        lines.push(`      http://${a.address}:${actualPort}   [${a.name}]`);
      }
    }
  }
  lines.push('');
  lines.push(`  On this PC:  http://localhost:${actualPort}`);
  lines.push('');
  lines.push('  If the phone cannot reach it: Windows Firewall is likely');
  lines.push('  blocking port ' + actualPort + '. From an elevated PowerShell, run:');
  lines.push('      npm run firewall:open');
  lines.push('');
  lines.push('  Press Ctrl+C to stop.');
  lines.push(bar);
  lines.push('');
  return lines.join('\n');
}

// On Windows we have to pass `shell: true` so Node invokes the shell to
// resolve `npm` (a `.cmd` shim). Node 20+ blocks direct `spawn` of
// .cmd/.bat without it (EINVAL) as a path-injection mitigation, and
// Node 25 enforces it strictly. We pass the command as a single string
// (rather than (cmd, [args])) to avoid Node's DEP0190 deprecation
// warning — the command is hard-coded, not user input.
const isWin = process.platform === 'win32';

const child = spawn('npm run dev', {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
  shell: isWin ? true : '/bin/sh',
});

let bannerShown = false;
function maybeShowBanner(chunk) {
  // Next prints e.g. "- Local:        http://localhost:4001" — the bound
  // port shows up there even when it had to roll forward off our default
  // (port in use, etc). Capture it so the banner advertises the real URL.
  const m = chunk.match(/Local:\s+https?:\/\/(?:localhost|\[?::\]?|0\.0\.0\.0):(\d+)/i);
  if (m) actualPort = m[1];
  if (bannerShown) return;
  if (/Ready in|ready - started server|started server on/i.test(chunk)) {
    bannerShown = true;
    // Give Next a beat to finish flushing its own startup lines.
    setTimeout(() => process.stdout.write(banner()), 150);
  }
}

child.stdout.on('data', (buf) => {
  const s = buf.toString();
  process.stdout.write(s);
  maybeShowBanner(s);
});
child.stderr.on('data', (buf) => {
  const s = buf.toString();
  process.stderr.write(s);
  maybeShowBanner(s);
});

const forwardSignal = (sig) => () => {
  if (!child.killed) child.kill(sig);
};
process.on('SIGINT', forwardSignal('SIGINT'));
process.on('SIGTERM', forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
