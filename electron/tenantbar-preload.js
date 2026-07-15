const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tenantAPI', {
  getState:  ()          => ipcRenderer.invoke('tenant-get-state'),
  switchTo:  (clientId)  => ipcRenderer.invoke('tenant-switch', clientId),
  close:     (clientId)  => ipcRenderer.invoke('tenant-close', clientId),
  popOut:    (clientId)  => ipcRenderer.invoke('tenant-pop-out', clientId),
  mergeBack: (clientId)  => ipcRenderer.invoke('tenant-merge-back', clientId),
  addTenant: ()          => ipcRenderer.invoke('tenant-new'),
  onUpdate:  (cb)        => ipcRenderer.on('tenant-state-update', (_, s) => cb(s)),
});
