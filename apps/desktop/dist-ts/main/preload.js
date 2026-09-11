import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('pharmacy', {
    printReceipt: (receipt) => ipcRenderer.invoke('print-receipt', receipt),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
    saveFile: (suggestedName, data) => ipcRenderer.invoke('save-file', { suggestedName, data }),
    syncLogo: (serverUrl, updatedAt) => ipcRenderer.invoke('logo:sync', { serverUrl, updatedAt }),
});
