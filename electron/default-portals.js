// Keep in sync with DEFAULT_PORTALS / GOOGLE_PORTALS in src/portals.js — icons live
// there (Vite-bundled SVGs); this is just id/name/url for the main process, which
// can't import those assets directly.
const DEFAULT_PORTALS = [
  { id: 'admin',      name: 'M365 Admin',     url: 'https://admin.microsoft.com' },
  { id: 'entra',      name: 'Entra ID',       url: 'https://entra.microsoft.com' },
  { id: 'exchange',   name: 'Exchange',       url: 'https://admin.exchange.microsoft.com' },
  { id: 'teams',      name: 'Teams Admin',    url: 'https://admin.teams.microsoft.com' },
  { id: 'intune',     name: 'Intune',         url: 'https://endpoint.microsoft.com' },
  { id: 'sharepoint', name: 'SharePoint',     url: 'https://admin.sharepoint.com' },
  { id: 'security',   name: 'Defender XDR',   url: 'https://security.microsoft.com' },
  { id: 'compliance', name: 'Compliance',     url: 'https://compliance.microsoft.com' },
  { id: 'purview',    name: 'Purview',        url: 'https://purview.microsoft.com' },
  { id: 'azure',      name: 'Azure Portal',   url: 'https://portal.azure.com' },
  { id: 'partner',    name: 'Partner Center', url: 'https://partner.microsoft.com' },
  { id: 'billing',    name: 'Billing',        url: 'https://admin.microsoft.com/Adminportal/Home#/subscriptions' },
];

const GOOGLE_PORTALS = [
  { id: 'google-admin',  name: 'Google Admin',  url: 'https://admin.google.com' },
  { id: 'google-cloud',  name: 'Google Cloud',  url: 'https://console.cloud.google.com' },
  { id: 'google-vault',  name: 'Google Vault',  url: 'https://vault.google.com' },
  { id: 'google-groups', name: 'Google Groups', url: 'https://groups.google.com' },
];

module.exports = { DEFAULT_PORTALS, GOOGLE_PORTALS };
