const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getClients: () => ipcRenderer.invoke('get-clients'),
  addClient: (fields) => ipcRenderer.invoke('add-client', fields),
  updateClient: (id, fields) => ipcRenderer.invoke('update-client', id, fields),
  deleteClient: (id) => ipcRenderer.invoke('delete-client', id),
  openPortal: (opts) => ipcRenderer.invoke('open-portal', opts),
  exportClients: () => ipcRenderer.invoke('export-clients'),
  importClients: () => ipcRenderer.invoke('import-clients'),
  mergeClients: (incoming) => ipcRenderer.invoke('merge-clients', incoming),
  onClientsUpdated: (cb) => ipcRenderer.on('clients-updated', (_, list) => cb(list)),
});
