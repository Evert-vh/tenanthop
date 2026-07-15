const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabAPI', {
  getState:   ()           => ipcRenderer.invoke('tab-get-state'),
  switchTab:  (cid, idx)   => ipcRenderer.invoke('tab-switch',  cid, idx),
  reorderTab: (cid, from, to) => ipcRenderer.invoke('tab-reorder', cid, from, to),
  closeTab:   (cid, idx)   => ipcRenderer.invoke('tab-close',   cid, idx),
  newTab:     (cid)        => ipcRenderer.invoke('tab-new',     cid),
  reopenClosed: (cid)      => ipcRenderer.invoke('tab-reopen-closed', cid),
  nav:        (cid, action)=> ipcRenderer.invoke('tab-nav',     cid, action),
  go:         (cid, url)   => ipcRenderer.invoke('tab-go',      cid, url),
  toggleSave: (cid)        => ipcRenderer.invoke('tab-toggle-save', cid),
  openSwitcher: (cid)      => ipcRenderer.invoke('switcher-toggle', cid),
  onUpdate:   (cb)         => ipcRenderer.on('tab-state-update', (_, s) => cb(s)),
  getTheme:   ()           => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb)      => ipcRenderer.on('theme-update', (_, theme) => cb(theme)),
});
