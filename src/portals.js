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
