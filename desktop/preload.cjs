const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("selotip", {
  openFile: () => ipcRenderer.invoke("selotip:open-file"),
  saveFile: (request) => ipcRenderer.invoke("selotip:save-file", request),
  confirmDiscard: () => ipcRenderer.invoke("selotip:confirm-discard"),
  runCode: (language, code) => ipcRenderer.invoke("selotip:run-code", language, code),
});
