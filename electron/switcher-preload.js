const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('switcherAPI', {
  onOpen: (cb) => ipcRenderer.on('switcher-open', (_, data) => cb(data)),
  go:     (fromClientId, targetClientId, portal) => ipcRenderer.invoke('switcher-go', fromClientId, targetClientId, portal),
  close:  (clientId) => ipcRenderer.invoke('switcher-close', clientId),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb) => ipcRenderer.on('theme-update', (_, theme) => cb(theme)),
});
