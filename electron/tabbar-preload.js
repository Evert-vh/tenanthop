const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabAPI', {
  getState:   ()           => ipcRenderer.invoke('tab-get-state'),
  switchTab:  (cid, idx)   => ipcRenderer.invoke('tab-switch',  cid, idx),
  closeTab:   (cid, idx)   => ipcRenderer.invoke('tab-close',   cid, idx),
  onUpdate:   (cb)         => ipcRenderer.on('tab-state-update', (_, s) => cb(s)),
});
