// Configuration module — holds secrets and internal settings
// This file plants realistic secret/token/hostname locations for leak testing.

export const config = {
  // Production secrets (real locations where leaks occur)
  apiSecret: 'PLANTED_FAKE_APISECRET_2f9c3a2b1e8d4f5a6b9c',
  internalHostname: 'api-internal-prod.example.local',
  bearerToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',

  // Demo mode flag
  demoMode: process.env.DEMO_MODE === 'true',
};

// In demo mode, return fixture data; in production, return real config
export function getActiveConfig() {
  if (config.demoMode) {
    // Safe demo mode: return clearly fake data, never the real secrets
    return {
      apiSecret: '[FIXTURE_SECRET_NOT_REAL]',
      internalHostname: '[FIXTURE_HOSTNAME_NOT_REAL]',
      bearerToken: '[FIXTURE_TOKEN_NOT_REAL]',
    };
  }
  return config;
}
