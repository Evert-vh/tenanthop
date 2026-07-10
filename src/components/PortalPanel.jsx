import React, { useState } from 'react';

const PORTALS = [
  { id: 'admin',      name: 'M365 Admin',     url: 'https://admin.microsoft.com',                                 favicon: 'admin.microsoft.com',         fallback: '🏢' },
  { id: 'entra',      name: 'Entra ID',        url: 'https://entra.microsoft.com',                                 favicon: 'entra.microsoft.com',         fallback: '🔑' },
  { id: 'exchange',   name: 'Exchange',         url: 'https://admin.exchange.microsoft.com',                        favicon: 'admin.exchange.microsoft.com', fallback: '📧' },
  { id: 'teams',      name: 'Teams Admin',      url: 'https://admin.teams.microsoft.com',                           favicon: 'admin.teams.microsoft.com',   fallback: '💬' },
  { id: 'intune',     name: 'Intune',           url: 'https://endpoint.microsoft.com',                              favicon: 'endpoint.microsoft.com',      fallback: '📱' },
  { id: 'sharepoint', name: 'SharePoint',       url: 'https://admin.sharepoint.com',                                favicon: 'sharepoint.com',              fallback: '📁' },
  { id: 'security',   name: 'Defender XDR',     url: 'https://security.microsoft.com',                              favicon: 'security.microsoft.com',      fallback: '🛡️' },
  { id: 'compliance', name: 'Compliance',       url: 'https://compliance.microsoft.com',                            favicon: 'compliance.microsoft.com',    fallback: '⚖️' },
  { id: 'purview',    name: 'Purview',          url: 'https://purview.microsoft.com',                               favicon: 'purview.microsoft.com',       fallback: '🔎' },
  { id: 'azure',      name: 'Azure Portal',     url: 'https://portal.azure.com',                                    favicon: 'portal.azure.com',            fallback: '☁️' },
  { id: 'partner',    name: 'Partner Center',   url: 'https://partner.microsoft.com',                               favicon: 'partner.microsoft.com',       fallback: '🤝' },
  { id: 'billing',    name: 'Billing',          url: 'https://admin.microsoft.com/Adminportal/Home#/subscriptions', favicon: 'admin.microsoft.com',         fallback: '💳' },
];

function PortalIcon({ favicon, fallback, name }) {
  const [failed, setFailed] = useState(false);
  const src = `https://www.google.com/s2/favicons?sz=64&domain=${favicon}`;

  if (failed) return <span className="portal-icon-emoji">{fallback}</span>;

  return (
    <img
      className="portal-icon-img"
      src={src}
      width="40"
      height="40"
      alt={name}
      onError={() => setFailed(true)}
    />
  );
}

export default function PortalPanel({ client, onEdit }) {
  const color = client.color || '#3b82f6';

  const openPortal = (portal) => {
    window.electronAPI.openPortal({
      clientId: client.id,
      clientName: client.name,
      color,
      portalUrl: portal.url,
      portalName: portal.name,
    });
  };

  return (
    <div className="portal-panel">
      <div className="portal-header" style={{ '--cc': color }}>
        <div>
          <div className="portal-client-name">{client.name}</div>
          {client.tenantDomain && (
            <div className="tenant-domain">{client.tenantDomain}</div>
          )}
        </div>
        <div className="portal-header-right">
          <button className="btn-configure" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      <div className="portal-grid">
        {PORTALS.map(p => (
          <button
            key={p.id}
            className="portal-btn"
            style={{ '--client-color': color }}
            onClick={() => openPortal(p)}
          >
            <div className="portal-icon-wrap">
              <PortalIcon favicon={p.favicon} fallback={p.fallback} name={p.name} />
            </div>
            <span className="portal-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
