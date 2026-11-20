const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

ipcMain.handle("serpost-api:request", async (_event, { baseUrl, token, path: reqPath, method = "GET", body }) => {
  try {
    const cleanBase = (baseUrl || "http://localhost:3001").replace(/\/+$/, "");
    const cleanPath = reqPath.startsWith("/") ? reqPath : `/${reqPath}`;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${cleanBase}${cleanPath}`, {
      method,
      headers,
      body: body !== undefined && method !== "GET" && method !== "HEAD" ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text || null;
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : (typeof data === "string" ? data : JSON.stringify(data)),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "Error de red",
    };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
