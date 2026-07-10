import React, { useState, useEffect, useCallback } from 'react';
import ClientList from './components/ClientList';
import PortalPanel from './components/PortalPanel';
import ClientModal from './components/ClientModal';

export default function App() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState(null); // null=closed, {}=add, {id,...}=edit
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    setLoading(true);
    const list = await window.electronAPI.getClients();
    setClients(list);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const handleSave = async (fields) => {
    if (editingClient?.id) {
      const updated = await window.electronAPI.updateClient(editingClient.id, fields);
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
    } else {
      const created = await window.electronAPI.addClient(fields);
      setClients(prev => [...prev, created]);
      setSelectedId(created.id);
    }
    setEditingClient(null);
  };

  const handleExport = async () => {
    await window.electronAPI.exportClients();
  };

  const handleImport = async () => {
    const imported = await window.electronAPI.importClients();
    if (imported) {
      setClients(imported);
      setSelectedId(null);
    }
  };

  const handleDelete = async (id) => {
    const deleted = await window.electronAPI.deleteClient(id);
    if (!deleted) return;
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selectedClient = clients.find(c => c.id === selectedId) || null;

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">M365 Launcher</span>
        <div className="header-actions">
          <button className="btn-header-action" onClick={handleImport}>Import</button>
          <button className="btn-header-action" onClick={handleExport}>Export</button>
          <div className="header-divider" />
          <button className="btn-add-client" onClick={() => setEditingClient({})}>+ Add client</button>
        </div>
      </header>

      <div className="main-layout">
        <ClientList
          clients={clients}
          selectedId={selectedId}
          search={search}
          loading={loading}
          onSelect={setSelectedId}
          onEdit={setEditingClient}
          onDelete={handleDelete}
          onSearchChange={setSearch}
        />
        <main className="content">
          {selectedClient ? (
            <PortalPanel
              client={selectedClient}
              onEdit={() => setEditingClient(selectedClient)}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⬚</div>
              <p>{clients.length === 0 && !loading ? 'Add your first client to get started' : 'Select a client to launch portals'}</p>
            </div>
          )}
        </main>
      </div>

      {editingClient !== null && (
        <ClientModal
          client={editingClient?.id ? editingClient : null}
          onSave={handleSave}
          onClose={() => setEditingClient(null)}
        />
      )}
    </div>
  );
}
