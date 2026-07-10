const { app, BrowserWindow, BaseWindow, ipcMain, dialog, WebContentsView, Menu, clipboard, session } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const { randomUUID } = require('crypto');

const isDev = process.env.NODE_ENV === 'development';

// One-time migration from the pre-rename data dir (m365-launcher → tenanthop):
// carries over clients (config.json) and saved sign-in sessions (Partitions/)
try {
  const newDir = app.getPath('userData');
  const oldDir = path.join(newDir, '..', 'm365-launcher');
  if (!fs.existsSync(path.join(newDir, 'config.json')) && fs.existsSync(path.join(oldDir, 'config.json'))) {
    fs.cpSync(oldDir, newDir, { recursive: true, force: false });
  }
} catch { /* fresh install or copy failure — start clean */ }

const store = new Store();

// Keep in sync with COLOR_PALETTE in src/components/ClientModal.jsx
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#6366f1', '#0ea5e9', '#d97706', '#dc2626',
  '#64748b', '#be185d', '#15803d', '#b45309', '#7c3aed',
];

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    title: 'TenantHop',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Client CRUD ----

ipcMain.handle('get-clients', () => store.get('clients', []));

ipcMain.handle('add-client', (_, { name, color, tenantDomain }) => {
  const clients = store.get('clients', []);
  const client = {
    id: randomUUID(),
    name,
    color: color || COLORS[clients.length % COLORS.length],
    tenantDomain: tenantDomain || '',
  };
  clients.push(client);
  store.set('clients', clients);
  return client;
});

ipcMain.handle('update-client', (_, id, fields) => {
  const clients = store.get('clients', []);
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return null;
  clients[idx] = { ...clients[idx], ...fields };
  store.set('clients', clients);
  return clients[idx];
});

ipcMain.handle('delete-client', async (_, id) => {
  const clients = store.get('clients', []);
  const client = clients.find(c => c.id === id);
  if (!client) return false;

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Delete client',
    message: `Delete "${client.name}"?`,
    detail: 'This closes their portal window and clears their saved sign-in session.',
  });
  if (response !== 0) return false;

  const state = clientWindows.get(id);
  if (state) state.win.close();
  try {
    await session.fromPartition(`persist:client-${id}`).clearStorageData();
  } catch { /* partition may never have been used */ }

  store.set('clients', clients.filter(c => c.id !== id));
  return true;
});

// ---- Import / Export ----

ipcMain.handle('export-clients', async () => {
  const clients = store.get('clients', []);
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export clients',
    defaultPath: 'tenanthop-clients.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify({ clients }, null, 2), 'utf8');
  return true;
});

ipcMain.handle('import-clients', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import clients',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const { clients } = JSON.parse(raw);
    if (!Array.isArray(clients)) return null;
    const sanitized = clients.map(c => ({
      id: c.id || randomUUID(),
      name: String(c.name || '').trim(),
      color: c.color || COLORS[0],
      tenantDomain: c.tenantDomain || '',
      portals: sanitizePortals(c.portals),
    })).filter(c => c.name);
    return sanitized.length ? sanitized : null;
  } catch {
    return null;
  }
});

// Merge selected imported clients into the existing list. Matches by id or
// name (case-insensitive); matches keep their existing id so the client's
// saved sign-in session (persist:client-{id}) stays attached.
function sanitizePortals(portals) {
  if (!portals || typeof portals !== 'object') return undefined;
  return {
    disabled: Array.isArray(portals.disabled) ? portals.disabled.filter(x => typeof x === 'string') : [],
    custom: Array.isArray(portals.custom)
      ? portals.custom
          .filter(p => p && p.name && p.url)
          .map(p => ({ id: p.id || randomUUID(), name: String(p.name), url: String(p.url) }))
      : [],
  };
}

ipcMain.handle('merge-clients', (_, incoming) => {
  const clients = store.get('clients', []);
  for (const inc of incoming) {
    const idx = clients.findIndex(c =>
      c.id === inc.id || c.name.toLowerCase() === inc.name.toLowerCase()
    );
    const fields = {
      name: inc.name,
      color: inc.color,
      tenantDomain: inc.tenantDomain || '',
      ...(inc.portals ? { portals: sanitizePortals(inc.portals) } : {}),
    };
    if (idx >= 0) {
      clients[idx] = { ...clients[idx], ...fields };
    } else {
      clients.push({ id: inc.id || randomUUID(), ...fields });
    }
  }
  store.set('clients', clients);
  return clients;
});

// ---- Portal windows (tabbed browser per client) ----

const clientWindows = new Map();
const TAB_BAR_H = 78; // tab row (40) + nav row (38)

function getFaviconUrl(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; }
  catch { return null; }
}

function serializeState(clientId, state) {
  const client = store.get('clients', []).find(c => c.id === clientId);
  const savedUrls = new Set((client?.portals?.custom || []).map(p => p.url));
  return {
    clientId,
    clientName: state.clientName,
    color: state.color,
    activeIdx: state.activeIdx,
    tabs: state.tabs.map(t => {
      const wc = t.wcv.webContents;
      const alive = !wc.isDestroyed();
      const url = alive ? wc.getURL() : '';
      const cleanUrl = url.startsWith('data:') ? '' : url;
      return {
        title: t.title,
        favicon: t.favicon,
        url: cleanUrl,
        isSaved: savedUrls.has(cleanUrl),
        canGoBack: alive && wc.canGoBack(),
        canGoForward: alive && wc.canGoForward(),
      };
    }),
  };
}

function notifyTabBar(clientId, state) {
  const wc = state.tabBarWcv.webContents;
  if (!wc.isDestroyed()) wc.send('tab-state-update', serializeState(clientId, state));
}

function resizeViews(state) {
  const { width, height } = state.win.getContentBounds();
  state.tabBarWcv.setBounds({ x: 0, y: 0, width, height: TAB_BAR_H });
  state.tabs.forEach((tab, i) => {
    tab.wcv.setBounds({ x: 0, y: TAB_BAR_H, width, height: height - TAB_BAR_H });
    tab.wcv.setVisible(i === state.activeIdx);
  });
}

ipcMain.handle('tab-get-state', (event) => {
  for (const [clientId, state] of clientWindows) {
    if (state.tabBarWcv.webContents === event.sender) return serializeState(clientId, state);
  }
  return null;
});

ipcMain.handle('tab-switch', (_, clientId, idx) => {
  const state = clientWindows.get(clientId);
  if (!state) return;
  state.tabs.forEach((t, i) => t.wcv.setVisible(i === idx));
  state.activeIdx = idx;
  notifyTabBar(clientId, state);
});

function closeTab(clientId, state, idx) {
  const tab = state.tabs[idx];
  if (!tab) return;
  state.win.contentView.removeChildView(tab.wcv);
  if (!tab.wcv.webContents.isDestroyed()) tab.wcv.webContents.destroy();
  state.tabs.splice(idx, 1);
  if (state.tabs.length === 0) { state.win.close(); return; }
  if (idx < state.activeIdx) state.activeIdx--;
  else if (idx === state.activeIdx) state.activeIdx = Math.min(idx, state.tabs.length - 1);
  state.tabs.forEach((t, i) => t.wcv.setVisible(i === state.activeIdx));
  notifyTabBar(clientId, state);
}

ipcMain.handle('tab-close', (_, clientId, idx) => {
  const state = clientWindows.get(clientId);
  if (state) closeTab(clientId, state, idx);
});

function activeWebContents(clientId) {
  const state = clientWindows.get(clientId);
  const tab = state?.tabs[state.activeIdx];
  if (!tab || tab.wcv.webContents.isDestroyed()) return null;
  return tab.wcv.webContents;
}

ipcMain.handle('tab-nav', (_, clientId, action) => {
  const wc = activeWebContents(clientId);
  if (!wc) return;
  if (action === 'back' && wc.canGoBack()) wc.goBack();
  else if (action === 'forward' && wc.canGoForward()) wc.goForward();
  else if (action === 'reload') wc.reload();
});

ipcMain.handle('tab-go', (_, clientId, url) => {
  const wc = activeWebContents(clientId);
  if (!wc) return;
  let target = String(url || '').trim();
  if (!target) return;
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
  wc.loadURL(target).catch(() => {});
});

// Bookmark star: save/remove the active tab's page as a custom portal
ipcMain.handle('tab-toggle-save', (_, clientId) => {
  const wc = activeWebContents(clientId);
  if (!wc) return;
  const url = wc.getURL();
  if (!url || url.startsWith('data:')) return;

  const clients = store.get('clients', []);
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const portals = {
    disabled: client.portals?.disabled || [],
    custom: client.portals?.custom || [],
  };
  const idx = portals.custom.findIndex(p => p.url === url);
  if (idx >= 0) {
    portals.custom.splice(idx, 1);
  } else {
    let name = (wc.getTitle() || '').trim();
    if (name.length > 40) name = name.slice(0, 40).trim() + '…';
    if (!name) { try { name = new URL(url).hostname; } catch { name = url; } }
    portals.custom.push({ id: `custom-${Date.now()}`, name, url });
  }
  client.portals = portals;
  store.set('clients', clients);

  const state = clientWindows.get(clientId);
  if (state) notifyTabBar(clientId, state);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clients-updated', clients);
  }
});

// Deny invasive permission requests (mic, camera, geolocation, ...) per client session.
// Electron grants everything by default without this.
const configuredPartitions = new Set();
function getClientPartition(clientId) {
  const partition = `persist:client-${clientId}`;
  if (!configuredPartitions.has(partition)) {
    configuredPartitions.add(partition);
    session.fromPartition(partition).setPermissionRequestHandler((_wc, permission, callback) => {
      callback(['fullscreen', 'clipboard-sanitized-write'].includes(permission));
    });
  }
  return partition;
}

// AAD auth popups talk back to their opener via postMessage — they must stay
// real popups, not tabs, or sign-in hangs forever.
const LOGIN_POPUP_HOSTS = new Set([
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.live.com',
  'login.windows.net',
  'device.login.microsoftonline.com',
]);

function isLoginPopup(url) {
  if (!url || url === 'about:blank') return true; // OAuth popups often open blank, then navigate
  try { return LOGIN_POPUP_HOSTS.has(new URL(url).hostname); }
  catch { return false; }
}

function addTab(clientId, state, url, initialTitle) {
  const { win } = state;
  const { width, height } = win.getContentBounds();

  const wcv = new WebContentsView({
    webPreferences: { partition: getClientPartition(clientId), nodeIntegration: false, contextIsolation: true },
  });
  win.contentView.addChildView(wcv);
  wcv.setBounds({ x: 0, y: TAB_BAR_H, width, height: height - TAB_BAR_H });

  const tab = { wcv, title: initialTitle, favicon: getFaviconUrl(url) };
  state.tabs.push(tab);
  const newIdx = state.tabs.length - 1;
  state.tabs.forEach((t, i) => t.wcv.setVisible(i === newIdx));
  state.activeIdx = newIdx;

  // Update tab title and favicon as page navigates/loads
  wcv.webContents.on('page-title-updated', (_, title) => {
    if (title) { tab.title = title; notifyTabBar(clientId, state); }
  });
  wcv.webContents.on('did-navigate', (_, navUrl) => {
    tab.favicon = getFaviconUrl(navUrl);
    notifyTabBar(clientId, state);
  });
  wcv.webContents.on('did-navigate-in-page', () => notifyTabBar(clientId, state));

  // Login popups stay popups (they postMessage back to their opener);
  // everything else target="_blank" / window.open becomes a new tab
  wcv.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    if (isLoginPopup(newUrl)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 550, height: 750, autoHideMenuBar: true },
      };
    }
    addTab(clientId, state, newUrl, (() => { try { return new URL(newUrl).hostname; } catch { return newUrl; } })());
    notifyTabBar(clientId, state);
    return { action: 'deny' };
  });

  // Simple error page on failed loads (skip -3 = navigation aborted, which is normal)
  wcv.webContents.on('did-fail-load', (_, code, desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    const html = `<!doctype html><html><body style="background:#0f0f1a;color:#e2e8f0;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center;max-width:480px">
        <div style="font-size:40px;margin-bottom:16px;opacity:.4">⚠</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">Page failed to load</div>
        <div style="font-size:12px;color:#8892a4;margin-bottom:20px;word-break:break-all">${desc} — ${failedUrl}</div>
        <a href="${failedUrl}" style="color:#3b82f6;font-size:13px">Try again</a>
      </div>
    </body></html>`;
    wcv.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});
  });

  // Keyboard shortcuts (app menu is disabled, so these are wired per-tab)
  wcv.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    let handled = true;

    if (input.key === 'F5' || (ctrl && key === 'r')) wcv.webContents.reload();
    else if (ctrl && key === 'w') closeTab(clientId, state, state.tabs.indexOf(tab));
    else if (input.key === 'F12' || (ctrl && input.shift && key === 'i')) wcv.webContents.toggleDevTools();
    else if (ctrl && (key === '=' || key === '+')) wcv.webContents.setZoomLevel(wcv.webContents.getZoomLevel() + 0.5);
    else if (ctrl && key === '-') wcv.webContents.setZoomLevel(wcv.webContents.getZoomLevel() - 0.5);
    else if (ctrl && key === '0') wcv.webContents.setZoomLevel(0);
    else if (ctrl && input.alt && key === 'arrowleft') { if (wcv.webContents.canGoBack()) wcv.webContents.goBack(); }
    else if (ctrl && input.alt && key === 'arrowright') { if (wcv.webContents.canGoForward()) wcv.webContents.goForward(); }
    else handled = false;

    if (handled) event.preventDefault();
  });

  // Right-click context menu
  wcv.webContents.on('context-menu', (_, params) => {
    const items = [];

    if (params.linkURL) {
      items.push({ label: 'Open link in new tab', click: () => { addTab(clientId, state, params.linkURL, (() => { try { return new URL(params.linkURL).hostname; } catch { return params.linkURL; } })()); notifyTabBar(clientId, state); } });
      items.push({ label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) });
      items.push({ type: 'separator' });
    }

    if (params.selectionText) {
      items.push({ label: 'Copy', click: () => clipboard.writeText(params.selectionText) });
      items.push({ type: 'separator' });
    }

    if (params.isEditable) {
      if (params.selectionText) items.push({ label: 'Cut', click: () => wcv.webContents.cut() });
      items.push({ label: 'Paste', click: () => wcv.webContents.paste() });
      items.push({ type: 'separator' });
    }

    items.push({ label: 'Back',    enabled: wcv.webContents.canGoBack(),    click: () => wcv.webContents.goBack() });
    items.push({ label: 'Forward', enabled: wcv.webContents.canGoForward(), click: () => wcv.webContents.goForward() });
    items.push({ label: 'Reload',  click: () => wcv.webContents.reload() });

    Menu.buildFromTemplate(items).popup({ window: win });
  });

  wcv.webContents.loadURL(url);
  notifyTabBar(clientId, state);
  return tab;
}

ipcMain.handle('open-portal', (_, { clientId, clientName, color, portalUrl, portalName }) => {
  let state = clientWindows.get(clientId);

  if (!state) {
    const win = new BaseWindow({ width: 1400, height: 900, title: clientName, backgroundColor: '#0f0f1a' });

    const tabBarWcv = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, 'tabbar-preload.js'), contextIsolation: true, nodeIntegration: false },
    });
    win.contentView.addChildView(tabBarWcv);
    const { width } = win.getContentBounds();
    tabBarWcv.setBounds({ x: 0, y: 0, width, height: TAB_BAR_H });
    tabBarWcv.webContents.loadFile(path.join(__dirname, 'tabbar.html'));

    state = { win, tabBarWcv, tabs: [], activeIdx: -1, clientName, color };
    clientWindows.set(clientId, state);
    win.on('resize', () => resizeViews(state));
    win.on('closed', () => {
      state.tabs.forEach(t => { if (!t.wcv.webContents.isDestroyed()) t.wcv.webContents.destroy(); });
      clientWindows.delete(clientId);
    });
  }

  const { win } = state;
  if (win.isMinimized()) win.restore();
  win.focus();

  addTab(clientId, state, portalUrl, portalName);
  return true;
});
