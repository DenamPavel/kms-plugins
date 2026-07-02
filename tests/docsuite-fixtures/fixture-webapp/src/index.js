// Entry point for fixture-webapp
// Demonstrates a simple data flow: index → auth → config
// In demo mode, no real secrets are exposed

import { config } from './config.js';
import { AuthenticatedClient } from './auth.js';

async function main() {
  const demoMode = config.demoMode;

  console.log(`Fixture webapp starting (demo mode: ${demoMode})`);

  const client = new AuthenticatedClient();
  const authHeader = client.getAuthHeader();

  if (demoMode) {
    console.log('Demo mode: using fixture credentials (safe to capture)');
    console.log(`Auth header: ${authHeader}`);
  } else {
    console.log('Production mode: using real credentials (should never be captured)');
    console.log('Auth established');
  }

  console.log('Fixture webapp ready');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
