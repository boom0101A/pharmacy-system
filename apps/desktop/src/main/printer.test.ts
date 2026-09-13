import { beforeEach, describe, expect, it, vi } from 'vitest';

const isPrinterConnected = vi.fn();
const code128 = vi.fn();
const println = vi.fn();
const alignCenter = vi.fn();
const cut = vi.fn();
const execute = vi.fn();

vi.mock('node-thermal-printer', () => ({
  ThermalPrinter: vi.fn().mockImplementation(() => ({
    isPrinterConnected,
    code128,
    println,
    alignCenter,
    cut,
    execute,
  })),
  PrinterTypes: { EPSON: 'epson' },
}));

const { printBarcodeLabel } = await import('./printer.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('printBarcodeLabel', () => {
  it('throws a clear Arabic error when the printer is not connected', async () => {
    isPrinterConnected.mockResolvedValue(false);

    await expect(
      printBarcodeLabel('usb://dummy', { barcode: '200000000042', productName: 'بانادول' }),
    ).rejects.toThrow('الطابعة غير متصلة');

    expect(code128).not.toHaveBeenCalled();
  });

  it('prints the code128 barcode followed by the product name, then cuts', async () => {
    isPrinterConnected.mockResolvedValue(true);

    await printBarcodeLabel('usb://dummy', { barcode: '200000000042', productName: 'بانادول' });

    expect(code128).toHaveBeenCalledWith('200000000042', expect.any(Object));
    expect(println).toHaveBeenCalledWith('بانادول');
    expect(cut).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
