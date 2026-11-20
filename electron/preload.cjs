const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("serpostApi", {
  request: (payload) => ipcRenderer.invoke("serpost-api:request", payload),
});
