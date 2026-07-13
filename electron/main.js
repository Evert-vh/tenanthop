const { app, BrowserWindow, BaseWindow, ipcMain, dialog, WebContentsView, Menu, clipboard, session } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const { randomUUID } = require('crypto');
const { DEFAULT_PORTALS: DEFAULT_PORTAL_CATALOG, GOOGLE_PORTALS: GOOGLE_PORTAL_CATALOG } = require('./default-portals');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';

// One-time migration from pre-rename data dirs (m365-launcher → tenanthop → tenanthub):
// carries over clients (config.json) and saved sign-in sessions (Partitions/)
try {
  const newDir = app.getPath('userData');
  if (!fs.existsSync(path.join(newDir, 'config.json'))) {
    for (const oldName of ['tenanthop', 'm365-launcher']) {
      const oldDir = path.join(newDir, '..', oldName);
      if (fs.existsSync(path.join(oldDir, 'config.json'))) {
        fs.cpSync(oldDir, newDir, { recursive: true, force: false });
        break;
      }
    }
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
    title: 'TenantHub',
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

  // Session status dots may be stale after time spent in portal windows — refresh
  // whenever the user comes back to the launcher.
  mainWindow.on('focus', () => pushClientStatuses());

  // Zoom shortcuts — no app menu, so wire these directly (matches portal windows)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    if (ctrl && (key === '=' || key === '+')) {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5);
      event.preventDefault();
    } else if (ctrl && key === '-') {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5);
      event.preventDefault();
    } else if (ctrl && key === '0') {
      mainWindow.webContents.setZoomLevel(0);
      event.preventDefault();
    } else if (ctrl && /^[1-9]$/.test(input.key)) {
      // Renderer owns the portal grid (which tiles are visible depends on React
      // state), so just forward which slot was requested.
      mainWindow.webContents.send('open-portal-slot', parseInt(input.key, 10));
      event.preventDefault();
    }
  });
}

// ---- Auto-update ----
// Checks the public GitHub repo's releases on launch. Only meaningful in a
// packaged build — running from source has no installed app to update in place.
function setupAutoUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `TenantHub ${info.version} is ready to install.`,
      detail: 'Restart now to finish updating, or it\'ll install next time you quit.',
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  // Offline, no releases published yet, etc. — fail quietly, don't interrupt work
  autoUpdater.on('error', () => {});

  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Client CRUD ----

ipcMain.handle('get-clients', () => store.get('clients', []));

ipcMain.handle('add-client', (_, { name, color, tenantDomain, platforms }) => {
  const clients = store.get('clients', []);
  const client = {
    id: randomUUID(),
    name,
    color: color || COLORS[clients.length % COLORS.length],
    tenantDomain: tenantDomain || '',
    favorite: false,
    platforms: {
      m365: platforms?.m365 !== false,
      google: !!platforms?.google,
    },
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
    defaultPath: 'tenanthub-clients.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify({ clients }, null, 2), 'utf8');
  return true;
});

ipcMain.handle('import-clients', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import clients',
    filters: [
      { name: 'Supported files', extensions: ['json', 'cfg'] },
      { name: 'TenantHub export', extensions: ['json'] },
      { name: 'Portals config export', extensions: ['cfg'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);

    let clients;
    if (Array.isArray(parsed['users-data'])) {
      // PortalsReleases .cfg export: map tenant accounts to clients
      clients = parsed['users-data'].map((u, i) => ({
        name: u.friendlyName || u.tenant || u.name,
        color: COLORS[i % COLORS.length],
        tenantDomain: u.tenant ? `${u.tenant}.onmicrosoft.com` : '',
      }));
    } else {
      clients = parsed.clients;
    }

    if (!Array.isArray(clients)) return null;
    const sanitized = clients.map((c, i) => ({
      id: c.id || randomUUID(),
      name: String(c.name || '').trim(),
      color: c.color || COLORS[i % COLORS.length],
      tenantDomain: c.tenantDomain || '',
      portals: sanitizePortals(c.portals),
      platforms: sanitizePlatforms(c.platforms),
    })).filter(c => c.name);
    return sanitized.length ? sanitized : null;
  } catch {
    return null;
  }
});

function sanitizePlatforms(platforms) {
  return {
    m365: platforms?.m365 !== false,
    google: !!platforms?.google,
  };
}

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
      ...(inc.platforms ? { platforms: sanitizePlatforms(inc.platforms) } : {}),
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

// ---- Update notes ----
// Shown once after auto-update installs a newer version (or after a manual
// install/portable swap) — whenever the running version differs from the last one
// the user actually launched. Add an entry here with each notable release.
const CHANGELOG = {
  '1.1.0': [
    'Quick switcher (Ctrl+K) can now jump straight into a specific portal for any client, not just their window — try typing a client name plus a portal name.',
    'Ctrl+1 through Ctrl+9 open a client’s portal tiles directly, in the order they appear in the grid.',
    'A dot on each client in the sidebar shows whether they still have a signed-in session.',
    'Ctrl+Shift+T (or right-click the tab strip) reopens the last tab you closed in a portal window.',
    'Portal sessions now present as a normal Chrome browser instead of identifying as Electron, which can reduce how often Microsoft challenges for re-authentication.',
  ],
  '1.1.1': [
    'Added an "About TenantHub" page (ⓘ in the header) — a rundown of every feature and the full keyboard shortcut list, in one place.',
  ],
  '1.2.0': [
    'Clients can now preload Google Workspace portals (Admin, Cloud, Vault, Groups) alongside or instead of Microsoft 365 — pick either or both when adding or editing a client.',
  ],
  '1.3.0': [
    'TenantHub now checks for updates automatically and installs them in the background — you\'ll just get a "restart to finish updating" prompt when one\'s ready, instead of having to reinstall by hand.',
  ],
};

ipcMain.handle('get-update-notes', () => {
  const current = app.getVersion();
  const lastSeen = store.get('lastSeenVersion');
  if (!lastSeen) {
    // First run with version tracking at all — nothing to compare against yet.
    // Baseline silently rather than showing notes for a version they just installed.
    store.set('lastSeenVersion', current);
    return null;
  }
  if (lastSeen === current || !CHANGELOG[current]) return null;
  return { version: current, notes: CHANGELOG[current] };
});

ipcMain.handle('mark-update-seen', () => {
  store.set('lastSeenVersion', app.getVersion());
});

// ---- Portal windows (tabbed browser per client) ----

const clientWindows = new Map();
const TAB_BAR_H = 78; // tab row (40) + nav row (38)

function getFaviconUrl(url) {
  if (!url || url.startsWith('data:')) return null;
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
  if (state.switcherWcv) state.switcherWcv.setBounds({ x: 0, y: 0, width, height });
}

// Ctrl+K quick switcher — jump to another client's window without going back to
// the launcher. Built lazily per client window and reused for the life of the window.
function toggleSwitcher(clientId, state) {
  const { win } = state;
  if (!state.switcherWcv) {
    const wcv = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, 'switcher-preload.js'), contextIsolation: true, nodeIntegration: false },
    });
    wcv.setVisible(false);
    win.contentView.addChildView(wcv);
    const { width, height } = win.getContentBounds();
    wcv.setBounds({ x: 0, y: 0, width, height });
    wcv.webContents.loadFile(path.join(__dirname, 'switcher.html'));

    wcv.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const ctrl = input.control || input.meta;
      if (input.key === 'Escape' || (ctrl && input.key.toLowerCase() === 'k')) {
        toggleSwitcher(clientId, state);
        event.preventDefault();
      }
    });

    state.switcherWcv = wcv;
    state.switcherOpen = false;
  }

  const wcv = state.switcherWcv;
  state.switcherOpen = !state.switcherOpen;

  if (state.switcherOpen) {
    win.contentView.removeChildView(wcv);
    win.contentView.addChildView(wcv); // re-add to bring to top z-order
    const { width, height } = win.getContentBounds();
    wcv.setBounds({ x: 0, y: 0, width, height });
    wcv.setVisible(true);
    wcv.webContents.focus();
    wcv.webContents.send('switcher-open', {
      clients: store.get('clients', []),
      currentClientId: clientId,
      defaultPortals: DEFAULT_PORTAL_CATALOG,
      googlePortals: GOOGLE_PORTAL_CATALOG,
    });
  } else {
    wcv.setVisible(false);
  }
}

// Create (or reuse) a client's BaseWindow + tab strip. Looks client name/color up
// from the store so it's always current, regardless of who's asking (the launcher's
// "open portal" click, or the quick switcher jumping in from another client window).
function ensureClientWindow(clientId) {
  let state = clientWindows.get(clientId);
  if (state) return state;

  const client = store.get('clients', []).find(c => c.id === clientId);
  if (!client) return null;

  const win = new BaseWindow({ width: 1400, height: 900, title: client.name, backgroundColor: '#0f0f1a' });

  const tabBarWcv = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'tabbar-preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.contentView.addChildView(tabBarWcv);
  const { width } = win.getContentBounds();
  tabBarWcv.setBounds({ x: 0, y: 0, width, height: TAB_BAR_H });
  tabBarWcv.webContents.loadFile(path.join(__dirname, 'tabbar.html'));

  state = { win, tabBarWcv, tabs: [], activeIdx: -1, clientName: client.name, color: client.color, closedStack: [] };
  clientWindows.set(clientId, state);

  // Tab-strip shortcuts work even when focus is in the address bar, not just in a tab
  tabBarWcv.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    if (ctrl && input.shift && key === 't') { reopenClosedTab(clientId, state); event.preventDefault(); }
    else if (ctrl && key === 't') { newTab(clientId, state); event.preventDefault(); }
    else if (ctrl && key === 'k') { toggleSwitcher(clientId, state); event.preventDefault(); }
  });

  tabBarWcv.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      { label: 'New tab', click: () => newTab(clientId, state) },
      { label: 'Reopen closed tab', enabled: state.closedStack.length > 0, click: () => reopenClosedTab(clientId, state) },
    ]).popup({ window: win });
  });

  win.on('resize', () => resizeViews(state));
  win.on('closed', () => {
    state.tabs.forEach(t => { if (!t.wcv.webContents.isDestroyed()) t.wcv.webContents.destroy(); });
    if (state.switcherWcv && !state.switcherWcv.webContents.isDestroyed()) state.switcherWcv.webContents.destroy();
    clientWindows.delete(clientId);
    pushClientStatuses();
  });

  return state;
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

const CLOSED_STACK_MAX = 15;

function closeTab(clientId, state, idx) {
  const tab = state.tabs[idx];
  if (!tab) return;
  const wc = tab.wcv.webContents;
  if (!wc.isDestroyed()) {
    const url = wc.getURL();
    if (url && !url.startsWith('data:')) {
      state.closedStack.push({ url, title: tab.title });
      if (state.closedStack.length > CLOSED_STACK_MAX) state.closedStack.shift();
    }
  }
  state.win.contentView.removeChildView(tab.wcv);
  if (!wc.isDestroyed()) wc.destroy();
  state.tabs.splice(idx, 1);
  if (state.tabs.length === 0) { state.win.close(); return; }
  if (idx < state.activeIdx) state.activeIdx--;
  else if (idx === state.activeIdx) state.activeIdx = Math.min(idx, state.tabs.length - 1);
  state.tabs.forEach((t, i) => t.wcv.setVisible(i === state.activeIdx));
  notifyTabBar(clientId, state);
}

function newTab(clientId, state) {
  return addTab(clientId, state, NEW_TAB_URL, 'New Tab');
}

function reopenClosedTab(clientId, state) {
  const entry = state.closedStack.pop();
  if (!entry) return;
  addTab(clientId, state, entry.url, entry.title);
}

ipcMain.handle('tab-close', (_, clientId, idx) => {
  const state = clientWindows.get(clientId);
  if (state) closeTab(clientId, state, idx);
});

ipcMain.handle('tab-new', (_, clientId) => {
  const state = clientWindows.get(clientId);
  if (state) newTab(clientId, state);
});

ipcMain.handle('tab-reopen-closed', (_, clientId) => {
  const state = clientWindows.get(clientId);
  if (state) reopenClosedTab(clientId, state);
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

// A plain Chrome UA (no "Electron/x.x.x" token) — some identity providers treat the
// default Electron UA as a less-trusted/unrecognized client and challenge more often.
// Built from the real bundled Chromium version so it stays internally consistent.
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

// Deny invasive permission requests (mic, camera, geolocation, ...) per client session.
// Electron grants everything by default without this.
const configuredPartitions = new Set();
function getClientPartition(clientId) {
  const partition = `persist:client-${clientId}`;
  if (!configuredPartitions.has(partition)) {
    configuredPartitions.add(partition);
    const ses = session.fromPartition(partition);
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(['fullscreen', 'clipboard-sanitized-write'].includes(permission));
    });
    ses.setUserAgent(CHROME_UA);
  }
  return partition;
}

// Microsoft's persistent/session auth cookies live on the shared Entra ID login
// domain regardless of which portal you're actually using — checking there tells us
// whether a client still has a usable session without opening a window for them.
async function getClientAuthStatus(clientId) {
  try {
    const ses = session.fromPartition(`persist:client-${clientId}`);
    const cookies = await ses.cookies.get({});
    const authCookies = cookies.filter(c =>
      (c.name === 'ESTSAUTHPERSISTENT' || c.name === 'ESTSAUTH') &&
      /login\.microsoftonline\.com|login\.microsoft\.com/.test(c.domain)
    );
    if (authCookies.length === 0) return 'signed-out';
    const stillValid = authCookies.some(c => !c.expirationDate || c.expirationDate * 1000 > Date.now());
    return stillValid ? 'signed-in' : 'expired';
  } catch {
    return 'unknown';
  }
}

async function getAllClientStatuses() {
  const clients = store.get('clients', []);
  const entries = await Promise.all(clients.map(async c => [c.id, await getClientAuthStatus(c.id)]));
  return Object.fromEntries(entries);
}

ipcMain.handle('get-client-statuses', () => getAllClientStatuses());

async function pushClientStatuses() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('client-statuses-updated', await getAllClientStatuses());
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

// Branded page shown for freshly-opened blank tabs, instead of a plain white screen.
// A data: URL keeps the address bar empty (same treatment as about:blank) so it still
// reads as "nothing typed yet" rather than showing a page URL.
const NEW_TAB_URL = (() => {
  let iconDataUri = '';
  try {
    const iconBuf = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png'));
    iconDataUri = `data:image/png;base64,${iconBuf.toString('base64')}`;
  } catch { /* icon missing — page still renders without it */ }
  const html = `<!doctype html><html><body style="margin:0;height:100vh;background:#0f0f1a;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="text-align:center">
      ${iconDataUri ? `<img src="${iconDataUri}" width="88" height="88" style="border-radius:20px;margin-bottom:18px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.4))">` : ''}
      <div style="color:#e2e8f0;font-size:20px;font-weight:700;letter-spacing:-.3px">TenantHub</div>
      <div style="color:#8892a4;font-size:12px;margin-top:8px">Type a URL above to get started</div>
    </div>
  </body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
})();

function addTab(clientId, state, url, initialTitle) {
  const { win } = state;
  const { width, height } = win.getContentBounds();

  const wcv = new WebContentsView({
    backgroundColor: '#0f0f1a',
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
    else if (ctrl && input.shift && key === 't') reopenClosedTab(clientId, state);
    else if (ctrl && key === 't') newTab(clientId, state);
    else if (ctrl && key === 'w') closeTab(clientId, state, state.tabs.indexOf(tab));
    else if (ctrl && key === 'k') toggleSwitcher(clientId, state);
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

ipcMain.handle('open-portal', (_, { clientId, portalUrl, portalName }) => {
  const state = ensureClientWindow(clientId);
  if (!state) return false;

  if (state.win.isMinimized()) state.win.restore();
  state.win.focus();

  addTab(clientId, state, portalUrl, portalName);
  pushClientStatuses();
  return true;
});

ipcMain.handle('switcher-toggle', (_, clientId) => {
  const state = clientWindows.get(clientId);
  if (state) toggleSwitcher(clientId, state);
});

ipcMain.handle('switcher-close', (_, clientId) => {
  const state = clientWindows.get(clientId);
  if (state?.switcherOpen) toggleSwitcher(clientId, state);
});

// portal (optional): { url, name } — jump straight into a specific portal instead
// of just focusing the client's window / giving them a blank tab
ipcMain.handle('switcher-go', (_, fromClientId, targetClientId, portal) => {
  const fromState = clientWindows.get(fromClientId);
  if (fromState?.switcherOpen) toggleSwitcher(fromClientId, fromState);

  const target = ensureClientWindow(targetClientId);
  if (!target) return false;
  if (target.win.isMinimized()) target.win.restore();
  target.win.focus();

  if (portal?.url) addTab(targetClientId, target, portal.url, portal.name);
  else if (target.tabs.length === 0) newTab(targetClientId, target);
  return true;
});
