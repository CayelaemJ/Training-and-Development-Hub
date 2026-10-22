'use strict';

// Secure online desktop shell: remote web content NEVER gets Node.js privileges.
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const { PORTAL_URL, allowsNavigation } = require('./navigation.cjs');

let mainWindow;
function createWindow() {
  const window = new BrowserWindow({
    title: 'CABO Learning Hub',
    width: 1280,
    height: 850,
    minWidth: 380,
    minHeight: 540,
    backgroundColor: '#0d1117',
    show: false,
    autoHideMenuBar: true,
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
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, _code, _description, _url, isMainFrame) => {
    if (isMainFrame && !window.isDestroyed()) {
      window.setTitle('CABO Learning Hub — connection unavailable');
    }
  });
  window.loadURL(PORTAL_URL).catch(() => { /* did-fail-load reports network failure */ });
  mainWindow = window;
}
app.whenReady().then(() => {
  // Explicitly deny camera, location, notifications, and all other permissions
  // unless a separate, reviewed product requirement approves them.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!allowsNavigation(url)) event.preventDefault();
    });
    contents.on('will-redirect', (event, url) => {
      if (!allowsNavigation(url)) event.preventDefault();
    });
    // Remote websites cannot create powerful popup windows.
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: 'CABO',
    submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
      }},
      { label: 'Open CABO in browser', click: () => shell.openExternal(PORTAL_URL) },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }]));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
