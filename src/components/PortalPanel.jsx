import React, { useState } from 'react';
import { visiblePortalsFor } from '../portals';

function normalizeUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); return url; } catch { return null; }
}

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

export default function PortalPanel({ client, onEdit, onUpdatePortals }) {
  const color = client.color || '#3b82f6';
  const visible = visiblePortalsFor(client);
  const custom = client.portals?.custom || [];

  const [hoveredPortalId, setHoveredPortalId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');

  const openPortal = (portal) => {
    window.electronAPI.openPortal({
      clientId: client.id,
      clientName: client.name,
      color,
      portalUrl: portal.url,
      portalName: portal.name,
    });
  };

  const removeDefault = (portal) => {
    if (!window.confirm(`Remove "${portal.name}" from this client's portal grid?`)) return;
    onUpdatePortals({
      disabled: [...(client.portals?.disabled || []), portal.id],
      custom: client.portals?.custom || [],
    });
  };

  const removeCustom = (portal) => {
    if (!window.confirm(`Remove "${portal.name}" from this client's portal grid?`)) return;
    onUpdatePortals({
      disabled: client.portals?.disabled || [],
      custom: (client.portals?.custom || []).filter(p => p.id !== portal.id),
    });
  };

  const confirmAdd = () => {
    const url = normalizeUrl(addUrl);
    if (!addName.trim() || !url) return;
    onUpdatePortals({
      disabled: client.portals?.disabled || [],
      custom: [...(client.portals?.custom || []), { id: `custom-${Date.now()}`, name: addName.trim(), url }],
    });
    setAddOpen(false);
    setAddName('');
    setAddUrl('');
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
        {visible.map(p => (
          <div
            key={p.id}
            className="portal-tile"
            onMouseEnter={() => setHoveredPortalId(p.id)}
            onMouseLeave={() => setHoveredPortalId(null)}
          >
            <button
              className="portal-btn"
              style={{ '--client-color': color }}
              onClick={() => openPortal(p)}
            >
              <div className="portal-icon-wrap">
                <img className="portal-icon-img" src={p.icon} width="32" height="32" alt={p.name} />
              </div>
              <span className="portal-name">{p.name}</span>
            </button>
            <button
              className="portal-remove-btn"
              title="Remove from grid"
              style={{ opacity: hoveredPortalId === p.id ? 1 : 0 }}
              onClick={() => removeDefault(p)}
            >✕</button>
          </div>
        ))}
        {custom.map(p => (
          <div
            key={p.id}
            className="portal-tile"
            onMouseEnter={() => setHoveredPortalId(p.id)}
            onMouseLeave={() => setHoveredPortalId(null)}
          >
            <button
              className="portal-btn"
              style={{ '--client-color': color }}
              onClick={() => openPortal(p)}
            >
              <div className="portal-icon-wrap">
                <CustomPortalIcon url={p.url} name={p.name} />
              </div>
              <span className="portal-name">{p.name}</span>
            </button>
            <button
              className="portal-remove-btn"
              title="Remove"
              style={{ opacity: hoveredPortalId === p.id ? 1 : 0 }}
              onClick={() => removeCustom(p)}
            >✕</button>
          </div>
        ))}
        <button className="portal-add-tile" onClick={() => setAddOpen(true)}>
          <div className="portal-add-icon">+</div>
          <span className="portal-name">Add portal</span>
        </button>
      </div>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add portal</h3>
              <button className="modal-close" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  className="text-input"
                  type="text"
                  placeholder="e.g. ConnectWise"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAdd()}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>URL</label>
                <input
                  className="text-input"
                  type="text"
                  placeholder="e.g. portal.example.com"
                  value={addUrl}
                  onChange={e => setAddUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAdd()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!addName.trim() || !normalizeUrl(addUrl)}
                onClick={confirmAdd}
              >Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
