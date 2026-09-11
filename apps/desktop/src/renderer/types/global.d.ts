import type { ReceiptData } from '@pharmacy/shared-types';

export {};

interface PharmacySettings {
  printerPath: string | null;
  pharmacyName: string | null;
  pharmacyAddress: string | null;
  pharmacyPhone: string | null;
}

declare global {
  interface Window {
    pharmacy: {
      printReceipt: (receipt: ReceiptData) => Promise<void>;
      getSettings: () => Promise<PharmacySettings>;
      setSettings: (patch: Partial<PharmacySettings>) => Promise<void>;
      saveFile: (suggestedName: string, data: ArrayBuffer) => Promise<void>;
      syncLogo: (serverUrl: string, updatedAt: string | null) => Promise<void>;
    };
  }
}
