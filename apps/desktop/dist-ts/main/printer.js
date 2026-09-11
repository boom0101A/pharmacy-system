import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import { Jimp, JimpMime } from 'jimp';
function formatMoney(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
/**
 * The printer library only accepts PNG bytes and does its own flat black/white
 * threshold with no resize step of its own — so the logo has to be narrowed to
 * a safe dot width first. 384px fits common 58mm printers; it prints a little
 * narrower than full-width on 80mm ones too, which is a safe default in the
 * absence of any paper-width setting in this app.
 */
const RECEIPT_LOGO_WIDTH = 384;
async function loadReceiptLogo(logoPath) {
    const image = await Jimp.read(logoPath);
    image.resize({ w: RECEIPT_LOGO_WIDTH });
    return image.getBuffer(JimpMime.png);
}
/**
 * Builds and sends the receipt. Runs in the Electron main process (Node
 * side), never the renderer — the USB/serial printer isn't reachable from a
 * sandboxed web page.
 */
export async function printReceipt(printerPath, receipt, pharmacy = { pharmacyName: null, pharmacyAddress: null, pharmacyPhone: null }, logoPath) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: printerPath,
        removeSpecialCharacters: false,
    });
    const connected = await printer.isPrinterConnected();
    if (!connected) {
        throw new Error('الطابعة غير متصلة — تحقّق من الاتصال والمنفذ');
    }
    if (logoPath) {
        try {
            printer.alignCenter();
            await printer.printImageBuffer(await loadReceiptLogo(logoPath));
        }
        catch {
            // A corrupt or unreadable cached logo must never stop the actual sale
            // receipt from printing — just skip straight to the text header below.
        }
    }
    printer.alignCenter();
    printer.bold(true);
    // The pharmacy's real name once it's set in Settings; the generic app name
    // is a placeholder for a till that hasn't been configured yet, not the
    // customer-facing identity a receipt should carry.
    printer.println(pharmacy.pharmacyName || 'نظام إدارة الصيدلية');
    printer.bold(false);
    // Each of these three lines only prints when filled in — a blank line on a
    // thermal receipt is waste, and most tills won't set all three.
    if (pharmacy.pharmacyAddress)
        printer.println(pharmacy.pharmacyAddress);
    if (pharmacy.pharmacyPhone)
        printer.println(pharmacy.pharmacyPhone);
    printer.println(new Date(receipt.date).toLocaleString('ar-IQ-u-nu-latn'));
    printer.drawLine();
    printer.alignRight();
    for (const item of receipt.items) {
        // The unit label distinguishes a "2 علبة" line from a "2 شريط" line —
        // a receipt couldn't tell them apart otherwise.
        printer.println(`${item.productName} (${item.unitLabel})`);
        printer.leftRight(`${item.quantity} × ${formatMoney(item.unitPrice)}`, formatMoney(item.quantity * item.unitPrice));
    }
    printer.drawLine();
    if (receipt.discount > 0) {
        printer.leftRight('الخصم', formatMoney(receipt.discount));
    }
    printer.bold(true);
    printer.leftRight('الإجمالي', formatMoney(receipt.total));
    printer.bold(false);
    printer.drawLine();
    printer.alignCenter();
    if (receipt.isTest) {
        printer.println('طباعة تجريبية');
    }
    else {
        printer.println(`فاتورة رقم ${receipt.saleId} — ${receipt.cashierName}`);
    }
    printer.cut();
    await printer.execute();
}
