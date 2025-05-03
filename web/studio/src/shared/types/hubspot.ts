/**
 * Shared domain types: HubSpot integration
 */
export interface HubspotCredential {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  agent: { id: string };
}

export interface HubspotTrigger {
  id: string;
  eventType: string;
  agent: { id: string };
}
