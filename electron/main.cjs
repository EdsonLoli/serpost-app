const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    window.loadURL(devUrl);
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.handle('serpost-api-request', async (_event, request) => {
  const baseUrl = String(request.baseUrl || '').replace(/\/$/, '');
  if (!baseUrl) {
    return { ok: false, error: 'Configure la URL del servicio.' };
  }

  try {
    const response = await fetch(`${baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(request.token ? { Authorization: `Bearer ${request.token}` } : {}),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : (data?.message || data?.detail || `Error HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo conectar con el servicio.',
    };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
