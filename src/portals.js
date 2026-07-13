import m365Icon from './assets/portals/m365.svg';
import entraIcon from './assets/portals/entra.svg';
import exchangeIcon from './assets/portals/exchange.svg';
import teamsIcon from './assets/portals/teams.svg';
import intuneIcon from './assets/portals/intune.svg';
import sharepointIcon from './assets/portals/sharepoint.svg';
import defenderIcon from './assets/portals/defender.svg';
import complianceIcon from './assets/portals/compliance.svg';
import purviewIcon from './assets/portals/purview.svg';
import azureIcon from './assets/portals/azure.svg';
import partnerIcon from './assets/portals/partner.svg';
import billingIcon from './assets/portals/billing.svg';
import googleAdminIcon from './assets/portals/google-admin.svg';
import googleCloudIcon from './assets/portals/google-cloud.svg';
import googleVaultIcon from './assets/portals/google-vault.svg';
import googleGroupsIcon from './assets/portals/google-groups.svg';

export const DEFAULT_PORTALS = [
  { id: 'admin',      name: 'M365 Admin',     url: 'https://admin.microsoft.com',                                 icon: m365Icon },
  { id: 'entra',      name: 'Entra ID',       url: 'https://entra.microsoft.com',                                 icon: entraIcon },
  { id: 'exchange',   name: 'Exchange',       url: 'https://admin.exchange.microsoft.com',                        icon: exchangeIcon },
  { id: 'teams',      name: 'Teams Admin',    url: 'https://admin.teams.microsoft.com',                           icon: teamsIcon },
  { id: 'intune',     name: 'Intune',         url: 'https://endpoint.microsoft.com',                              icon: intuneIcon },
  { id: 'sharepoint', name: 'SharePoint',     url: 'https://admin.sharepoint.com',                                icon: sharepointIcon },
  { id: 'security',   name: 'Defender XDR',   url: 'https://security.microsoft.com',                              icon: defenderIcon },
  { id: 'compliance', name: 'Compliance',     url: 'https://compliance.microsoft.com',                            icon: complianceIcon },
  { id: 'purview',    name: 'Purview',        url: 'https://purview.microsoft.com',                               icon: purviewIcon },
  { id: 'azure',      name: 'Azure Portal',   url: 'https://portal.azure.com',                                    icon: azureIcon },
  { id: 'partner',    name: 'Partner Center', url: 'https://partner.microsoft.com',                               icon: partnerIcon },
  { id: 'billing',    name: 'Billing',        url: 'https://admin.microsoft.com/Adminportal/Home#/subscriptions', icon: billingIcon },
];

export const GOOGLE_PORTALS = [
  { id: 'google-admin',  name: 'Google Admin',  url: 'https://admin.google.com',         icon: googleAdminIcon },
  { id: 'google-cloud',  name: 'Google Cloud',  url: 'https://console.cloud.google.com', icon: googleCloudIcon },
  { id: 'google-vault',  name: 'Google Vault',  url: 'https://vault.google.com',         icon: googleVaultIcon },
  { id: 'google-groups', name: 'Google Groups', url: 'https://groups.google.com',        icon: googleGroupsIcon },
];

// Which catalogs are active for a client, honoring the disabled-tile list. Custom
// portals are handled separately by callers (not part of any catalog).
export function visiblePortalsFor(client) {
  const disabled = new Set(client.portals?.disabled || []);
  const platforms = client.platforms || { m365: true, google: false };
  const catalogs = [
    ...(platforms.m365 !== false ? DEFAULT_PORTALS : []),
    ...(platforms.google ? GOOGLE_PORTALS : []),
  ];
  return catalogs.filter(p => !disabled.has(p.id));
}
