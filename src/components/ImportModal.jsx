import React, { useMemo, useState } from 'react';

export default function ImportModal({ incoming, existing, onConfirm, onClose }) {
  const withStatus = useMemo(() => incoming.map(inc => {
    const match = existing.find(c =>
      c.id === inc.id || c.name.toLowerCase() === inc.name.toLowerCase()
    );
    return { ...inc, isUpdate: !!match };
  }), [incoming, existing]);

  const [checked, setChecked] = useState(() => new Set(withStatus.map((_, i) => i)));

  const toggle = (i) => setChecked(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const allChecked = checked.size === withStatus.length;
  const selected = withStatus.filter((_, i) => checked.has(i));
  const newCount = selected.filter(c => !c.isUpdate).length;
  const updateCount = selected.length - newCount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import clients</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <label className="import-row select-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => setChecked(allChecked ? new Set() : new Set(withStatus.map((_, i) => i)))}
            />
            <span className="import-name">Select all</span>
          </label>

          <div className="import-list">
            {withStatus.map((c, i) => (
              <label key={i} className="import-row">
                <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
                <span className="color-dot" style={{ background: c.color }} />
                <span className="import-name">{c.name}</span>
                <span className={`import-status ${c.isUpdate ? 'update' : 'new'}`}>
                  {c.isUpdate ? 'Update' : 'New'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <span className="import-summary">
            {selected.length > 0 && [
              newCount > 0 ? `${newCount} new` : null,
              updateCount > 0 ? `${updateCount} update${updateCount === 1 ? '' : 's'}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected.map(({ isUpdate, ...c }) => c))}
          >
            Import {selected.length} client{selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
