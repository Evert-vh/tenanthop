import React, { useState, useEffect, useCallback, useRef } from 'react';
import ClientList from './components/ClientList';
import PortalPanel from './components/PortalPanel';
import ClientModal from './components/ClientModal';
import ImportModal from './components/ImportModal';
import UpdateNotesModal from './components/UpdateNotesModal';
import InfoModal from './components/InfoModal';
import { visiblePortalsFor } from './portals';

export default function App() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState(null); // null=closed, {}=add, {id,...}=edit
  const [importList, setImportList] = useState(null); // null=closed, [...]=picker open
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState({}); // clientId -> 'signed-in' | 'expired' | 'signed-out' | 'unknown'
  const [updateNotes, setUpdateNotes] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [theme, setTheme] = useState('dark');

  const loadClients = useCallback(async () => {
    setLoading(true);
    const list = await window.electronAPI.getClients();
    setClients(list);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Live refresh when a portal window bookmarks/unbookmarks a page
  useEffect(() => {
    window.electronAPI.onClientsUpdated(list => setClients(list));
  }, []);

  // Session status dots — fetch once, then take live pushes (a portal window
  // closing, or this window regaining focus, both trigger a refresh from main)
  useEffect(() => {
    window.electronAPI.getClientStatuses().then(setStatuses);
    window.electronAPI.onClientStatusesUpdated(setStatuses);
  }, []);

  // "What's new" — shows once per version, only when upgrading from a version
  // the user has actually run before (not on a fresh install)
  useEffect(() => {
    window.electronAPI.getUpdateNotes().then(notes => { if (notes) setUpdateNotes(notes); });
  }, []);

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion);
  }, []);

  // Theme — persisted in main, broadcast to every window so they all stay in sync.
  useEffect(() => {
    const apply = (t) => { setTheme(t); document.documentElement.dataset.theme = t; };
    window.electronAPI.getTheme().then(apply);
    window.electronAPI.onThemeChange(apply);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    window.electronAPI.setTheme(next);
  };

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
    const incoming = await window.electronAPI.importClients();
    if (incoming) setImportList(incoming);
  };

  const handleImportConfirm = async (selected) => {
    const merged = await window.electronAPI.mergeClients(selected);
    setClients(merged);
    setImportList(null);
  };

  const handleUpdatePortals = async (portals) => {
    if (!selectedClient) return;
    const updated = await window.electronAPI.updateClient(selectedClient.id, { portals });
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleToggleFavorite = async (id) => {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    const updated = await window.electronAPI.updateClient(id, { favorite: !client.favorite });
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDelete = async (id) => {
    const deleted = await window.electronAPI.deleteClient(id);
    if (!deleted) return;
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selectedClient = clients.find(c => c.id === selectedId) || null;

  // Kept fresh every render so the one-time IPC listener below always acts on
  // whichever client is currently selected, not whoever was selected at mount.
  const selectedClientRef = useRef(selectedClient);
  selectedClientRef.current = selectedClient;

  useEffect(() => {
    window.electronAPI.onOpenPortalSlot(n => {
      const client = selectedClientRef.current;
      if (!client) return;
      const portal = [...visiblePortalsFor(client), ...(client.portals?.custom || [])][n - 1];
      if (!portal) return;
      window.electronAPI.openPortal({
        clientId: client.id,
        portalUrl: portal.url,
        portalName: portal.name,
      });
    });
  }, []);

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">TenantHub</span>
        <div className="header-actions">
          <button className="btn-icon" title="About TenantHub" onClick={() => setShowInfo(true)}>ⓘ</button>
          <button className="btn-icon" title="Toggle light/dark theme" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {appVersion && <span className="version-tag">v{appVersion}</span>}
          <div className="header-divider" />
          <button className="btn-header-action" onClick={handleImport}>Import</button>
          <button className="btn-header-action" onClick={handleExport}>Export</button>
          <div className="header-divider" />
          <button className="btn-add-client" onClick={() => setEditingClient({})}>+ Add client</button>
        </div>
        <div className="caption-spacer" />
      </header>

      <div className="main-layout">
        <ClientList
          clients={clients}
          selectedId={selectedId}
          search={search}
          loading={loading}
          statuses={statuses}
          onSelect={setSelectedId}
          onDelete={handleDelete}
          onSearchChange={setSearch}
          onToggleFavorite={handleToggleFavorite}
        />
        <main className="content">
          {selectedClient ? (
            <PortalPanel
              client={selectedClient}
              onEdit={() => setEditingClient(selectedClient)}
              onUpdatePortals={handleUpdatePortals}
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

      {importList !== null && (
        <ImportModal
          incoming={importList}
          existing={clients}
          onConfirm={handleImportConfirm}
          onClose={() => setImportList(null)}
        />
      )}

      {updateNotes !== null && (
        <UpdateNotesModal
          notes={updateNotes}
          onClose={() => {
            window.electronAPI.markUpdateSeen();
            setUpdateNotes(null);
          }}
        />
      )}

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}

    </div>
  );
}
