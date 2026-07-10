import React, { useState } from 'react';
import { DEFAULT_PORTALS } from '../portals';

function CustomPortalIcon({ url, name }) {
  const [failed, setFailed] = useState(false);
  let host = '';
  try { host = new URL(url).hostname; } catch { /* bad url */ }
  const src = host ? `https://www.google.com/s2/favicons?sz=64&domain=${host}` : null;

  if (!src || failed) return <span className="portal-icon-emoji">🌐</span>;
  return (
    <img
      className="portal-icon-img"
      src={src}
      width="32"
      height="32"
      alt={name}
      onError={() => setFailed(true)}
    />
  );
}

export default function PortalPanel({ client, onEdit, onManagePortals }) {
  const color = client.color || '#3b82f6';
  const disabled = new Set(client.portals?.disabled || []);
  const visible = DEFAULT_PORTALS.filter(p => !disabled.has(p.id));
  const custom = client.portals?.custom || [];

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
          <button className="btn-configure" onClick={onManagePortals}>⊞ Portals</button>
          <button className="btn-configure" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      <div className="portal-grid">
        {visible.map(p => (
          <button
            key={p.id}
            className="portal-btn"
            style={{ '--client-color': color }}
            onClick={() => openPortal(p)}
          >
            <div className="portal-icon-wrap">
              <img className="portal-icon-img" src={p.icon} width="32" height="32" alt={p.name} />
            </div>
            <span className="portal-name">{p.name}</span>
          </button>
        ))}
        {custom.map(p => (
          <button
            key={p.id}
            className="portal-btn"
            style={{ '--client-color': color }}
            onClick={() => openPortal(p)}
          >
            <div className="portal-icon-wrap">
              <CustomPortalIcon url={p.url} name={p.name} />
            </div>
            <span className="portal-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
