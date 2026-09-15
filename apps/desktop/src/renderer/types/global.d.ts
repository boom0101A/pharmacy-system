import type { ReceiptData } from '@pharmacy/shared-types';

export {};

interface PharmacySettings {
  printerPath: string | null;
  pharmacyName: string | null;
  pharmacyAddress: string | null;
  pharmacyPhone: string | null;
  /** Whether this machine runs the bundled database and server, or uses another computer's. */
  serverMode: 'local' | 'remote';
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

  /** Progress of the database and server this installation carries with it (see src/main/backend). */
  type BackendStatus =
    | { status: 'disabled' }
    | { status: 'starting'; stage: 'database' | 'schema' | 'server' }
    | { status: 'ready' }
    | { status: 'failed'; message: string };

  interface Window {
    pharmacy: {
      printReceipt: (receipt: ReceiptData) => Promise<void>;
      printBarcodeLabel: (label: { barcode: string; productName: string }) => Promise<void>;
      getSettings: () => Promise<PharmacySettings>;
      setSettings: (patch: Partial<PharmacySettings>) => Promise<void>;
      saveFile: (suggestedName: string, data: ArrayBuffer) => Promise<void>;
      syncLogo: (serverUrl: string, updatedAt: string | null) => Promise<void>;
      getBackendStatus: () => Promise<BackendStatus>;
      getMachineId: () => Promise<string>;
      getLicenseStatus: () => Promise<LicenseCheck>;
      activateLicense: (key: string) => Promise<LicenseCheck>;
    };
  }
}
