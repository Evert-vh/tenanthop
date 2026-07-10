const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabAPI', {
  getState:   ()           => ipcRenderer.invoke('tab-get-state'),
  switchTab:  (cid, idx)   => ipcRenderer.invoke('tab-switch',  cid, idx),
  closeTab:   (cid, idx)   => ipcRenderer.invoke('tab-close',   cid, idx),
  nav:        (cid, action)=> ipcRenderer.invoke('tab-nav',     cid, action),
  go:         (cid, url)   => ipcRenderer.invoke('tab-go',      cid, url),
  onUpdate:   (cb)         => ipcRenderer.on('tab-state-update', (_, s) => cb(s)),
});
