const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "FlashCull",
    backgroundColor: '#0f0f0f', // Matches your app bg
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // In dev mode, load local Vite server; otherwise, load built index.html
  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '../dist/index.html')}`;
  win.loadURL(startUrl);
}

app.whenReady().then(() => {
  createWindow();

  // --- ADDED: File System Access API robust error handling ---
  session.defaultSession.on(
    'file-system-access-restricted',
    async (e, details, callback) => {
      await dialog.showMessageBox({
        message: `System restricted access to:\n"${details.path}".\nPlease select a subfolder instead.`,
        title: 'Folder Access Error',
        buttons: ['Try Again'],
      });
      callback('tryAgain'); // Forces picker to reset so user can select again
    }
  );
  // --- END ADDITION ---

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
