import { contextBridge, ipcRenderer } from 'electron';
import type { ReceiptData } from '@pharmacy/shared-types';
import type { Settings } from './settings-store.js';
import type { LicenseCheck } from './license.js';

contextBridge.exposeInMainWorld('pharmacy', {
  printReceipt: (receipt: ReceiptData): Promise<void> => ipcRenderer.invoke('print-receipt', receipt),
  printBarcodeLabel: (label: { barcode: string; productName: string }): Promise<void> =>
    ipcRenderer.invoke('print-barcode-label', label),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<void> => ipcRenderer.invoke('settings:set', patch),
  saveFile: (suggestedName: string, data: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('save-file', { suggestedName, data }),
  syncLogo: (serverUrl: string, updatedAt: string | null): Promise<void> =>
    ipcRenderer.invoke('logo:sync', { serverUrl, updatedAt }),
  getMachineId: (): Promise<string> => ipcRenderer.invoke('license:getMachineId'),
  getLicenseStatus: (): Promise<LicenseCheck> => ipcRenderer.invoke('license:getStatus'),
  activateLicense: (key: string): Promise<LicenseCheck> => ipcRenderer.invoke('license:activate', key),
});
