import React, { useState } from 'react';
import { DEFAULT_PORTALS } from '../portals';

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); return url; } catch { return null; }
}

export default function PortalsModal({ client, onSave, onClose }) {
  const [disabled, setDisabled] = useState(() => new Set(client.portals?.disabled || []));
  const [custom, setCustom] = useState(() => client.portals?.custom || []);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const toggle = (id) => setDisabled(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const addCustom = () => {
    const url = normalizeUrl(newUrl);
    if (!newName.trim() || !url) return;
    setCustom(prev => [...prev, { id: `custom-${Date.now()}`, name: newName.trim(), url }]);
    setNewName('');
    setNewUrl('');
  };

  const removeCustom = (id) => setCustom(prev => prev.filter(c => c.id !== id));

  const handleSave = () => {
    onSave({ portals: { disabled: [...disabled], custom } });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Portals — {client.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Default portals</label>
            <div className="import-list">
              {DEFAULT_PORTALS.map(p => (
                <label key={p.id} className="import-row">
                  <input
                    type="checkbox"
                    checked={!disabled.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <img src={p.icon} width="16" height="16" alt="" style={{ flexShrink: 0 }} />
                  <span className="import-name">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Custom portals</label>
            {custom.length > 0 && (
              <div className="import-list">
                {custom.map(c => (
                  <div key={c.id} className="import-row custom-portal-row">
                    <span className="import-name">{c.name}</span>
                    <span className="custom-portal-url">{c.url}</span>
                    <button
                      className="client-action-btn danger"
                      title="Remove"
                      onClick={() => removeCustom(c.id)}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="custom-portal-add">
              <input
                className="text-input"
                type="text"
                placeholder="Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
              />
              <input
                className="text-input"
                type="text"
                placeholder="URL (e.g. portal.example.com)"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
              />
              <button
                className="btn-secondary"
                disabled={!newName.trim() || !normalizeUrl(newUrl)}
                onClick={addCustom}
              >Add</button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
