const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serpostApi', {
  request: (request) => ipcRenderer.invoke('serpost-api-request', request),
});
