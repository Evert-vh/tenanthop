import React, { useMemo, useState } from 'react';

export default function ClientList({
  clients, selectedId, search, loading,
  onSelect, onDelete, onSearchChange, onToggleFavorite,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const filtered = useMemo(() => {
    const list = !search
      ? clients
      : clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  }, [clients, search]);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <input
          className="search-input"
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        <div className="filter-row">
          <span className="client-count">{filtered.length} client{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="client-list">
        {loading ? (
          <div className="list-loading">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="list-loading">{search ? 'No matches' : 'No clients yet'}</div>
        ) : filtered.map(client => {
          const isSelected = client.id === selectedId;
          const isHovered = client.id === hoveredId;
          return (
            <div
              key={client.id}
              className={`client-item${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(client.id)}
              onMouseEnter={() => setHoveredId(client.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span className="color-dot" style={{ background: client.color || '#6b7280' }} />
              <span className="client-name">{client.name}</span>
              <button
                className="favorite-btn"
                title={client.favorite ? 'Unpin' : 'Pin to top'}
                style={{
                  color: client.favorite ? (client.color || '#f59e0b') : '#8892a4',
                  opacity: client.favorite || isHovered ? 1 : 0,
                }}
                onClick={e => { e.stopPropagation(); onToggleFavorite(client.id); }}
              >{client.favorite ? '★' : '☆'}</button>
              {isHovered && (
                <span className="client-actions">
                  <button
                    className="client-action-btn danger"
                    title="Delete"
                    onClick={e => { e.stopPropagation(); onDelete(client.id); }}
                  >✕</button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
