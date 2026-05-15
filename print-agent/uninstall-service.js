// uninstall-service.js
// Run as Administrator: node uninstall-service.js
// Removes the "MAS Print Agent" Windows service.

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { default: Service } = await import('node-windows').then(m => ({ default: m.Service }));

const svc = new Service({
  name:   'MAS Print Agent',
  script: path.join(__dirname, 'src', 'index.js'),
});

svc.on('uninstall', () => {
  console.log('✅ MAS Print Agent Windows service removed.');
  console.log('   You can now reinstall with: node install-service.js');
});

svc.on('error', (err) => {
  console.error('❌ Uninstall error:', err);
});

svc.uninstall();
