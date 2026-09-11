import { contextBridge, ipcRenderer } from 'electron';
import type { ReceiptData } from '@pharmacy/shared-types';
import type { Settings } from './settings-store.js';

contextBridge.exposeInMainWorld('pharmacy', {
  printReceipt: (receipt: ReceiptData): Promise<void> => ipcRenderer.invoke('print-receipt', receipt),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<void> => ipcRenderer.invoke('settings:set', patch),
  saveFile: (suggestedName: string, data: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('save-file', { suggestedName, data }),
  syncLogo: (serverUrl: string, updatedAt: string | null): Promise<void> =>
    ipcRenderer.invoke('logo:sync', { serverUrl, updatedAt }),
});
