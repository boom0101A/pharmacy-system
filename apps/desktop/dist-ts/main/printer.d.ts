import type { ReceiptData } from '@pharmacy/shared-types';
export interface PharmacyInfo {
    pharmacyName: string | null;
    pharmacyAddress: string | null;
    pharmacyPhone: string | null;
}
/**
 * Builds and sends the receipt. Runs in the Electron main process (Node
 * side), never the renderer — the USB/serial printer isn't reachable from a
 * sandboxed web page.
 */
export declare function printReceipt(printerPath: string, receipt: ReceiptData, pharmacy?: PharmacyInfo, logoPath?: string | null): Promise<void>;
