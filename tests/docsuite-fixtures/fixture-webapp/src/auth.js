// Authentication module — uses config to authenticate requests
// This module's machinery depends on config.js, creating a data flow for the machinery map.

import { getActiveConfig } from './config.js';

export class AuthenticatedClient {
  constructor() {
    this.config = getActiveConfig();
  }

  authenticate() {
    // In safe demo mode, this returns fake credentials
    // In production, this would use the real secrets from config
    const credentials = {
      secret: this.config.apiSecret,
      hostname: this.config.internalHostname,
      token: this.config.bearerToken,
    };
    return credentials;
  }

  getAuthHeader() {
    const creds = this.authenticate();
    return creds.token;
  }
}
