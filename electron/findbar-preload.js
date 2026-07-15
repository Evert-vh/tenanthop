const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('findBarAPI', {
  search: (text, forward, findNext) => ipcRenderer.invoke('findbar-search', text, forward, findNext),
  stop: () => ipcRenderer.invoke('findbar-stop'),
  close: () => ipcRenderer.invoke('findbar-close'),
  onOpen: (cb) => ipcRenderer.on('findbar-open', () => cb()),
  onResult: (cb) => ipcRenderer.on('findbar-result', (_, r) => cb(r)),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb) => ipcRenderer.on('theme-update', (_, theme) => cb(theme)),
});
