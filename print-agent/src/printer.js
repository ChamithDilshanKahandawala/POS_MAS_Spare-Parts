// printer.js — Formats ESC/POS commands and sends to Windows local printer
//
// STRATEGY:
//   1. Build ESC/POS binary in memory using node-thermal-printer (interface='console')
//   2. Write binary to a temp file
//   3. Use PowerShell's [System.Drawing.Printing] API to send raw bytes
//      directly to the local Windows print spooler by PRINTER NAME.
//      This works even without UNC share / SMB, using the local printer name.

import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from './logger.js';
import { formatReceipt } from './formatter.js';

// Use the LOCAL printer name (as shown in "Devices and Printers") — NOT the UNC path.
// On the shop PC, the printer is local so we just use its name directly.
const PRINTER_NAME   = process.env.WINDOWS_PRINTER_NAME || 'POS-80C';
const DRAWER_ENABLED = process.env.DRAWER_ENABLED === 'true';

// ── ESC/POS raw command bytes ───────────────────────────────────────────────
// Cash drawer kick: ESC p 0 0x19 0x19 (pin 2, ~120ms pulse)
const DRAWER_KICK = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0x19]);
// Full paper cut: GS V 0
const FULL_CUT    = Buffer.from([0x1d, 0x56, 0x00]);
// Feed 4 lines before cut so receipt tears off cleanly
const FEED_LINES  = Buffer.from([0x1b, 0x64, 0x04]);

const RAW_PRINT_PS = (printerName, filePath) => `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOC_INFO_1 di);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
    public struct DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDataType; }
}
"@
$printerName = '${printerName}'
$filePath    = '${filePath}'
$bytes       = [System.IO.File]::ReadAllBytes($filePath)
$hPrinter    = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) { throw "OpenPrinter failed: " + [System.Runtime.InteropServices.Marshal]::GetLastWin32Error() }
$di = New-Object RawPrint+DOC_INFO_1; $di.pDocName = 'MAS Receipt'; $di.pDataType = 'RAW'; $di.pOutputFile = $null
if ([RawPrint]::StartDocPrinter($hPrinter, 1, [ref]$di) -eq 0) { $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error(); [RawPrint]::ClosePrinter($hPrinter); throw "StartDocPrinter failed with Win32 Error: $err" }
[RawPrint]::StartPagePrinter($hPrinter) | Out-Null
$ptr      = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$written  = 0
$result   = [RawPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrint]::EndPagePrinter($hPrinter) | Out-Null
[RawPrint]::EndDocPrinter($hPrinter) | Out-Null
[RawPrint]::ClosePrinter($hPrinter) | Out-Null
if (-not $result) { throw "WritePrinter failed - bytes written: $written" }
Write-Output "OK:$written"
`;

/**
 * Send a raw byte buffer to the Windows printer using the spooler API.
 */
function sendRawToPrinter(buffer) {
  const tmpBin = join(tmpdir(), `mas-receipt-${Date.now()}.bin`);
  const tmpPs1 = join(tmpdir(), `mas-print-${Date.now()}.ps1`);
  
  try {
    writeFileSync(tmpBin, buffer);
    const script = RAW_PRINT_PS(PRINTER_NAME, tmpBin.replace(/\\/g, '\\\\'));
    writeFileSync(tmpPs1, script);
    
    const output = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`,
      { timeout: 10000, encoding: 'utf8', windowsHide: true }
    ).trim();
    
    logger.info('Raw print result', { output });
    if (!output.startsWith('OK:')) throw new Error(`Unexpected output: ${output}`);
  } finally {
    if (existsSync(tmpBin)) { try { unlinkSync(tmpBin); } catch { /* ignore */ } }
    if (existsSync(tmpPs1)) { try { unlinkSync(tmpPs1); } catch { /* ignore */ } }
  }
}

/**
 * Build the complete ESC/POS binary for a receipt.
 */
async function buildEscPosBuffer(saleData) {
  const receipt = formatReceipt(saleData);
  const { shop, meta, items, totals, helpers } = receipt;
  const { LINE_WIDTH, padLeft, padRight, fmtAmount, buildItemRow } = helpers;

  const DIVIDER_HEAVY = '='.repeat(LINE_WIDTH);
  const DIVIDER_LIGHT = '-'.repeat(LINE_WIDTH);

  const printer = new ThermalPrinter({
    type:         PrinterTypes.EPSON,
    interface:    'console',    // we grab the buffer — no actual send
    characterSet: CharacterSet.PC437_USA,
    breakLine:    BreakLine.WORD,
    removeSpecialCharacters: false,
    lineCharacter: '-',
  });

  // ── HEADER ────────────────────────────────────────────────────────────────
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.bold(true);
  printer.println(shop.name);
  printer.bold(false);
  printer.setTextNormal();
  printer.println(shop.line1);
  printer.println(shop.line2);
  printer.println(`Tel: ${shop.phones}`);

  // ── META ──────────────────────────────────────────────────────────────────
  printer.alignLeft();
  printer.println(DIVIDER_HEAVY);
  printer.println(`Invoice: ${meta.invoiceNumber}`);
  printer.println(`Date:    ${meta.dateTime}`);
  printer.println(`Cashier: ${meta.cashierName}`);
  if (meta.saleSource !== 'shop') {
    const lbl = meta.saleSource === 'whatsapp' ? 'WhatsApp' : 'Online';
    printer.println(`Source:  ${lbl}`);
  }
  printer.println(DIVIDER_LIGHT);

  // ── ITEMS HEADER ──────────────────────────────────────────────────────────
  printer.println(padRight('Item', 22) + padLeft('Qty', 3) + padLeft('Price', 9) + padLeft('Total', 9));
  printer.println(DIVIDER_LIGHT);

  // ── LINE ITEMS ────────────────────────────────────────────────────────────
  for (const item of items) {
    printer.println(buildItemRow(item));
    if (item.discount > 0) {
      printer.println(`  Disc: -${fmtAmount(item.discount * (item.qty ?? item.quantity))}`);
    }
  }
  printer.println(DIVIDER_LIGHT);

  // ── TOTALS ────────────────────────────────────────────────────────────────
  printer.alignRight();
  printer.println(`Subtotal:  Rs. ${fmtAmount(totals.subtotal)}`);
  if (totals.discount > 0) printer.println(`Discount: -Rs. ${fmtAmount(totals.discount)}`);
  if (totals.shipping  > 0) printer.println(`Shipping:  Rs. ${fmtAmount(totals.shipping)}`);
  if (totals.kokoCharge > 0) printer.println(`KOKO Fee:  Rs. ${fmtAmount(totals.kokoCharge)}`);
  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println(`TOTAL: Rs. ${fmtAmount(totals.total)}`);
  printer.setTextNormal();
  printer.bold(false);
  printer.println(DIVIDER_LIGHT);

  // ── PAYMENT ───────────────────────────────────────────────────────────────
  printer.alignLeft();
  printer.println(`Payment:  ${meta.paymentMethod}`);
  if (meta.paymentMethod === 'Cash' && totals.amountPaid > 0) {
    printer.println(`Paid:     Rs. ${fmtAmount(totals.amountPaid)}`);
    printer.println(`Change:   Rs. ${fmtAmount(totals.change)}`);
  }
  if (meta.paymentMethod === 'COD') {
    const cod = saleData.cod_amount || saleData.codAmount || 0;
    if (cod > 0) printer.println(`COD Amt:  Rs. ${fmtAmount(cod)}`);
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  printer.println(DIVIDER_HEAVY);
  printer.alignCenter();
  printer.bold(true);
  printer.println(shop.footer);
  printer.bold(false);
  printer.println(DIVIDER_HEAVY);

  // Get the ESC/POS buffer from node-thermal-printer
  const printerBuffer = printer.getBuffer();

  // Append feed, optional drawer kick, then cut
  const parts = [printerBuffer, FEED_LINES];
  if (meta.paymentMethod === 'Cash' && DRAWER_ENABLED) parts.push(DRAWER_KICK);
  parts.push(FULL_CUT);

  return Buffer.concat(parts);
}

// ── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Check whether the local Windows printer is accessible.
 */
export async function checkPrinterReachable() {
  try {
    const output = execSync(
      `powershell -NoProfile -Command "Get-Printer -Name '${PRINTER_NAME}' | Select-Object -ExpandProperty PrinterStatus"`,
      { timeout: 4000, encoding: 'utf8', windowsHide: true }
    ).trim();
    return output !== '' && !output.toLowerCase().includes('error');
  } catch {
    return false;
  }
}

export async function printReceipt(saleData) {
  const buffer = await buildEscPosBuffer(saleData);
  sendRawToPrinter(buffer);
  logger.info('Receipt printed successfully');
}

export async function printTestReceipt() {
  return printReceipt({
    invoice_number: 'TEST-001',
    createdAt:      new Date().toISOString(),
    cashier_name:   'Setup Test',
    payment_method: 'Cash',
    sale_source:    'shop',
    items: [
      { product_name: 'Sample Part A',      quantity: 2, selling_price: 1500, line_total: 3000 },
      { product_name: 'Engine Oil 5W30 4L', quantity: 1, selling_price: 4200, line_total: 4200 },
      { product_name: 'Very Long Product Name That Should Be Truncated Cleanly', quantity: 1, selling_price: 500, line_total: 500 },
    ],
    subtotal: 7700, total_discount: 200, total_amount: 7500,
    koko_charge: 0, shipping_cost_charged: 0, paid_amount: 8000, change: 500,
  });
}

export async function openDrawer() {
  if (!DRAWER_ENABLED) throw new Error('DRAWER_ENABLED=false in .env');
  const tmpBin = join(tmpdir(), `mas-drawer-${Date.now()}.bin`);
  const tmpPs1 = join(tmpdir(), `mas-drawer-${Date.now()}.ps1`);
  try {
    writeFileSync(tmpBin, DRAWER_KICK);
    const script = RAW_PRINT_PS(PRINTER_NAME, tmpBin.replace(/\\/g, '\\\\'));
    writeFileSync(tmpPs1, script);
    
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`,
      { timeout: 5000, encoding: 'utf8', windowsHide: true }
    );
    logger.info('Cash drawer opened');
  } finally {
    if (existsSync(tmpBin)) { try { unlinkSync(tmpBin); } catch { /* ignore */ } }
    if (existsSync(tmpPs1)) { try { unlinkSync(tmpPs1); } catch { /* ignore */ } }
  }
}
