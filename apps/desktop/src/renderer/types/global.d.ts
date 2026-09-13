import type { ReceiptData } from '@pharmacy/shared-types';

export {};

interface PharmacySettings {
  printerPath: string | null;
  pharmacyName: string | null;
  pharmacyAddress: string | null;
  pharmacyPhone: string | null;
}

declare global {
  interface LicensePayload {
    licenseId: string;
    licensedTo: string;
    machineId: string;
    issuedAt: string;
    expiresAt: string | null;
  }

  type LicenseCheck = { valid: true; payload: LicensePayload } | { valid: false; error: string };

  interface Window {
    pharmacy: {
      printReceipt: (receipt: ReceiptData) => Promise<void>;
      printBarcodeLabel: (label: { barcode: string; productName: string }) => Promise<void>;
      getSettings: () => Promise<PharmacySettings>;
      setSettings: (patch: Partial<PharmacySettings>) => Promise<void>;
      saveFile: (suggestedName: string, data: ArrayBuffer) => Promise<void>;
      syncLogo: (serverUrl: string, updatedAt: string | null) => Promise<void>;
      getMachineId: () => Promise<string>;
      getLicenseStatus: () => Promise<LicenseCheck>;
      activateLicense: (key: string) => Promise<LicenseCheck>;
    };
  }
}
