'use strict';

// The packaged desktop app is a sandboxed window on the same HTTPS CABO service.
// No API tokens, learner records, passwords or signing credentials are bundled.
const { app, BrowserWindow, Menu, shell, session } = require('electron');

const PILOT_URL = 'https://cabo-learning-hub-pilot.onrender.com/';
const appUrl = new URL(PILOT_URL);
const appOrigin = appUrl.origin;

// Login is an OIDC redirect to an external identity provider. Review these
// origins against the configured issuer before promoting to production.
const identityHosts = new Set(['replit.com', 'accounts.google.com']);
const isAllowedNavigation = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    return url.origin === appOrigin || identityHosts.has(url.hostname) ||
      url.hostname.endsWith('.replit.com');
  } catch {
    return false;
  }
};

let mainWindow;
app.whenReady().then(() => {
  // Never grant browser content operating-system privileges implicitly.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, targetUrl) => {
      if (!isAllowedNavigation(targetUrl)) event.preventDefault();
    });
    contents.on('will-redirect', (event, targetUrl) => {
      if (!isAllowedNavigation(targetUrl)) event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  mainWindow = new BrowserWindow({
    title: 'CABO Learning Hub',
    width: 1280,
    height: 850,
    minWidth: 380,
    minHeight: 540,
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(appUrl.href);
  // This is a remote app; it cannot claim offline editing or submission.
  mainWindow.webContents.on('did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
    if (isMainFrame && !mainWindow.isDestroyed()) {
      mainWindow.setTitle('CABO Learning Hub — connection unavailable');
    }
  });

  const openPortal = () => shell.openExternal(appUrl.href);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'CABO',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Open CABO in browser', click: openPortal },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = new BrowserWindow({
      width: 1280, height: 850, webPreferences: {
        nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false
      }
    });
    if (mainWindow && !mainWindow.webContents.getURL()) mainWindow.loadURL(appUrl.href);
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
