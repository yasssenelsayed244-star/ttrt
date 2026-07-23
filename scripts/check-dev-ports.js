const net = require('net');

const PORTS = [3001, 5173];

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

async function main() {
  const busy = [];

  for (const port of PORTS) {
    if (await isPortInUse(port)) busy.push(port);
  }

  if (busy.length === 0) return;

  console.error('\nDev ports already in use:', busy.join(', '));
  console.error('Stop the running dev server (Ctrl+C) before starting another "npm run dev".\n');
  process.exit(1);
}

main();
