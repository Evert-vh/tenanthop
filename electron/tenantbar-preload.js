const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tenantAPI', {
  getState:  ()          => ipcRenderer.invoke('tenant-get-state'),
  switchTo:  (clientId)  => ipcRenderer.invoke('tenant-switch', clientId),
  close:     (clientId)  => ipcRenderer.invoke('tenant-close', clientId),
  popOut:    (clientId)  => ipcRenderer.invoke('tenant-pop-out', clientId),
  mergeBack: (clientId)  => ipcRenderer.invoke('tenant-merge-back', clientId),
  addTenant: ()          => ipcRenderer.invoke('tenant-new'),
  reorder:   (from, to)  => ipcRenderer.invoke('tenant-reorder', from, to),
  onUpdate:  (cb)        => ipcRenderer.on('tenant-state-update', (_, s) => cb(s)),
  getTheme:  ()          => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb)    => ipcRenderer.on('theme-update', (_, theme) => cb(theme)),
});
