// install-service.js
// Run ONCE as Administrator: node install-service.js
// Registers the print agent as a Windows service that auto-starts on boot.
//
// Prerequisites:
//   1. npm install has been run in this folder
//   2. .env file exists and is configured
//   3. This script is run from an ADMINISTRATOR PowerShell/CMD

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// node-windows is CommonJS — dynamic import for compatibility
const { default: Service } = await import('node-windows').then(m => ({ default: m.Service }));

const svc = new Service({
  name:        'MAS Print Agent',
  description: 'Mudiyanse Auto Solutions — Local thermal receipt printer agent for POS system',
  script:      path.join(__dirname, 'src', 'index.js'),
  nodeOptions: [],
  // Pass the .env file path so the service loads it
  env: [
    {
      name:  'NODE_ENV',
      value: 'production',
    },
  ],
  workingDirectory: __dirname,
});

svc.on('install', () => {
  console.log('✅ MAS Print Agent installed as Windows service.');
  console.log('   Starting service now...');
  svc.start();
});

svc.on('start', () => {
  console.log('✅ MAS Print Agent is running.');
  console.log('   Test it: http://localhost:9100/health');
});

svc.on('error', (err) => {
  console.error('❌ Service error:', err);
});

svc.on('invalidinstallation', () => {
  console.error('❌ Invalid installation — try uninstalling first: node uninstall-service.js');
});

svc.install();
