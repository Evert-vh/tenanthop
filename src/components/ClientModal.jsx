import React, { useState } from 'react';

const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#6366f1', '#0ea5e9', '#d97706', '#dc2626',
  '#64748b', '#be185d', '#15803d', '#b45309', '#7c3aed',
];

export default function ClientModal({ client, onSave, onClose }) {
  const isEdit = !!client?.id;
  const [name, setName] = useState(client?.name || '');
  const [color, setColor] = useState(client?.color || '#3b82f6');
  const [tenantDomain, setTenantDomain] = useState(client?.tenantDomain || '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, tenantDomain: tenantDomain.trim() });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit client' : 'Add client'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Client name</label>
            <input
              className="text-input"
              type="text"
              placeholder="e.g. Clarksville Medical Group"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Window colour</label>
            <div className="color-palette">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  className={`color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
            <div className="color-preview" style={{ background: color }}>
              {name || 'Client name preview'}
            </div>
          </div>

          <div className="form-group">
            <label>Tenant domain <span className="optional">(optional)</span></label>
            <input
              className="text-input"
              type="text"
              placeholder="e.g. contoso.onmicrosoft.com"
              value={tenantDomain}
              onChange={e => setTenantDomain(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            style={{ background: color }}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {isEdit ? 'Save' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  );
}
