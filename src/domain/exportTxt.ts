/**
 * Domain module: Order History ASCII Export
 *
 * Generates an ASCII-formatted plain text report matching the visual layout
 * and structure from legacy/main.py.
 * Ensures zero PCI-DSS exposure (no CVVs, only masked payment summaries).
 */

import { type Cents, addCents, formatPLN, toCents } from './money';
import type { SafePaymentInfo } from './payment';

export interface ExportOrderItem {
  readonly name: string;
  readonly quantity: number;
  readonly priceCents: Cents;
}

export interface ExportOrderRecord {
  readonly id?: string;
  readonly timestamp: string;
  readonly customer: {
    readonly name: string;
    readonly email?: string;
  };
  readonly paymentMethod: string;
  readonly paymentDetails?: SafePaymentInfo;
  readonly subtotalCents: Cents;
  readonly deliveryCents: Cents;
  readonly totalCents: Cents;
  readonly items?: readonly ExportOrderItem[];
}

export interface ExportTxtOptions {
  /** If true, uses ASCII currency symbol 'zl' */
  readonly ascii?: boolean;
}

/**
 * Generates the standardized timestamped filename for the order history export:
 * Format: `order_history_YYYYMMDD_HHMMSS.txt`
 */
export function generateOrderHistoryFilename(date: Date = new Date()): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `order_history_${year}${month}${day}_${hours}${minutes}${seconds}.txt`;
}

/**
 * Formats a payment method label with masked details for tabular display.
 */
function formatPaymentSummary(method: string, details?: SafePaymentInfo): string {
  if (!details) {
    return method;
  }
  switch (details.method) {
    case 'card':
      return `${method} (${details.last4 ? `**** ${details.last4}` : 'Karta'})`;
    case 'paypal':
      return `${method} (${details.email})`;
    case 'bitcoin': {
      const shortAddr =
        details.walletAddress.length > 10
          ? `${details.walletAddress.slice(0, 6)}...${details.walletAddress.slice(-4)}`
          : details.walletAddress;
      return `${method} (${shortAddr})`;
    }
  }
}

/**
 * Generates an ASCII text export table for an array of orders.
 * Follows the legacy column format: DATA | KLIENT | EMAIL | PLATNOSC | SUMA | DOSTAWA | TOTAL
 */
export function generateOrderHistoryTxt(
  orders: readonly ExportOrderRecord[],
  options: ExportTxtOptions = {}
): string {
  const title = 'SHOPPING CART - ORDER HISTORY EXPORT';

  if (orders.length === 0) {
    return [title, '='.repeat(title.length), 'Brak zamowien do wyeksportowania.', ''].join('\n');
  }

  const headers = ['DATA', 'KLIENT', 'EMAIL', 'PLATNOSC', 'SUMA', 'DOSTAWA', 'TOTAL'];

  const rows: string[][] = orders.map((order) => {
    const deliveryText =
      order.deliveryCents === 0 ? 'GRATIS' : formatPLN(order.deliveryCents, options);

    return [
      order.timestamp,
      order.customer.name || 'Anonimowy',
      order.customer.email || '-',
      formatPaymentSummary(order.paymentMethod, order.paymentDetails),
      formatPLN(order.subtotalCents, options),
      deliveryText,
      formatPLN(order.totalCents, options),
    ];
  });

  // Calculate column widths
  const widths: number[] = headers.map((h) => h.length);
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i] ?? '';
      const currentWidth = widths[i] ?? 0;
      if (cell.length > currentWidth) {
        widths[i] = cell.length;
      }
    }
  }

  const makeLine = (char: string): string => {
    return `+${widths.map((w) => char.repeat(w + 2)).join('+')}+`;
  };

  const formatRow = (values: readonly string[]): string => {
    const cells = values.map((val, idx) => {
      const w = widths[idx] ?? val.length;
      return ` ${val.padEnd(w, ' ')} `;
    });
    return `|${cells.join('|')}|`;
  };

  const lines: string[] = [];
  lines.push(title);
  lines.push(makeLine('='));
  lines.push(formatRow(headers));
  lines.push(makeLine('-'));

  for (const row of rows) {
    lines.push(formatRow(row));
  }
  lines.push(makeLine('='));

  // Summary footer
  const totalOrders = orders.length;
  const grandTotalCents = orders.reduce<Cents>(
    (acc, order) => addCents(acc, order.totalCents),
    toCents(0)
  );

  lines.push('');
  lines.push(`Liczba zamowien: ${totalOrders}`);
  lines.push(`Laczna kwota:    ${formatPLN(grandTotalCents, options)}`);

  return lines.join('\n');
}
