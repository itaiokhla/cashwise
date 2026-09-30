'use client';

import { jsPDF } from 'jspdf';

type DrCr = 'Dr' | 'Cr';

export type PaymentVoucherEntry = {
  ledgerName: string;
  ledgerId?: any;
  debitCredit: DrCr;
  amount: number;
  billName?: string | null;
  costCenter?: string | null;
};

export type PaymentVoucher = {
  _id?: any;
  voucherNumber: string;
  date: string | Date | { $date: string };
  voucherType?: string;
  
  cashBankLedgerName?: string;
  cashBankLedgerId?: any;
  instrumentType?: string;
  instrumentNumber?: string | number | null;
  instrumentDate?: string | Date | { $date: string } | null;
  recoDate?: string | Date | { $date: string } | null;
  
  narration?: string;
  entries: PaymentVoucherEntry[];
  totalAmount?: number;
  isBalanced?: boolean;
  status?: string;
  tallyIntegration?: boolean;
  tallyIntegrationDate?: string | Date | { $date: string } | null;
  createdAt?: string | Date | { $date: string };
  updatedAt?: string | Date | { $date: string };
};

type OrgInfo = {
  name?: string;
  address?: string;
  phone?: string;
};

const DEFAULT_ORG: Required<OrgInfo> = {
  name: "INTER-TECH",
  address: "Okhla, New Delhi",
  phone: "",
};

const pad2 = (n: number) => String(n).padStart(2, '0');

// Helper to parse MongoDB date format or regular date
const parseDate = (d: string | Date | { $date: string } | null | undefined): Date => {
  if (!d) return new Date();
  
  if (typeof d === 'string') {
    return new Date(d);
  }
  
  if (d instanceof Date) {
    return d;
  }
  
  // MongoDB format: { $date: "2026-01-08T00:00:00.000Z" }
  if (typeof d === 'object' && '$date' in d) {
    return new Date(d.$date);
  }
  
  return new Date();
};

const formatDateDDMMYY = (d: string | Date | { $date: string } | null | undefined) => {
  const date = parseDate(d);
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const formatDateDDMMYYYY = (d: string | Date | { $date: string } | null | undefined) => {
  const date = parseDate(d);
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const toINRWords = (num: number) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords2 = (n: number) => (n < 20 ? a[n] : `${b[Math.floor(n / 10)]}${n % 10 ? ' ' + a[n % 10] : ''}`.trim());
  const inWords3 = (n: number) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundred ? a[hundred] + ' Hundred' : ''}${rest ? (hundred ? ' ' : '') + inWords2(rest) : ''}`.trim();
  };

  const n = Math.round(Number(num || 0));
  if (!n) return 'Zero';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n / 100000) % 100);
  const thousand = Math.floor((n / 1000) % 100);
  const rem = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${inWords3(crore)} Crore`);
  if (lakh) parts.push(`${inWords3(lakh)} Lakh`);
  if (thousand) parts.push(`${inWords3(thousand)} Thousand`);
  if (rem) parts.push(inWords3(rem));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export function usePaymentVoucherPdf(org?: OrgInfo) {
  const orgInfo = { ...DEFAULT_ORG, ...(org || {}) };

  const downloadPaymentVoucherPdf = (voucher: PaymentVoucher) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Safely extract entries
    const entries = Array.isArray(voucher.entries) ? voucher.entries : [];
    const drLines = entries.filter(e => e.debitCredit === 'Dr');
    const crLines = entries.filter(e => e.debitCredit === 'Cr');

    // Extract party name (Dr entries)
    const partyName = drLines.map(d => d.ledgerName).join(', ') || 'N/A';
    
    // Extract cash/bank (prefer cashBankLedgerName, fallback to Cr entry)
    const cashBank = (voucher.cashBankLedgerName || crLines[0]?.ledgerName || 'Cash').trim();
    
    // Calculate amount
    const amount = voucher.totalAmount ?? drLines.reduce((s, e) => s + Number(e.amount || 0), 0) ?? 0;

    // Format dates
    const voucherDate = formatDateDDMMYY(voucher.date);
    const instrDate = voucher.instrumentDate ? formatDateDDMMYY(voucher.instrumentDate) : voucherDate;

    // Instrument details
    const instrumentType = (voucher.instrumentType || 'Cash').toUpperCase();
    const chequeNo = voucher.instrumentNumber ? String(voucher.instrumentNumber) : '';

    // --- Outer Border ---
    doc.setLineWidth(0.4);
    doc.rect(margin, margin, PW - margin * 2, PH - margin * 2);

    // --- Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(orgInfo.name, PW / 2, margin + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(orgInfo.address, PW / 2, margin + 12, { align: 'center' });

    // Form box area
    const boxX = margin;
    const boxY = margin + 16;
    const boxW = PW - margin * 2;
    const boxH = PH - boxY - margin;
    doc.setLineWidth(0.3);
    doc.rect(boxX, boxY, boxW, boxH);

    // Column split - right column for amount
    const rightColW = 55;
    const leftW = boxW - rightColW;
    const leftX = boxX;
    const rightX = boxX + leftW;

    doc.line(rightX, boxY, rightX, boxY + boxH);

    // Row heights - matching the image proportions
    const r1 = 9;   // Payment Voucher No
    const r2 = 13;  // Head
    const r3 = 13;  // Details of Expenses
    const r4 = 9;   // Name of Co/Bill/Date
    const r5 = 36;  // Passed By
    const r6 = 15;  // Approved by
    const r7 = 15;  // Paid by
    const r8 = boxH - (r1 + r2 + r3 + r4 + r5 + r6 + r7); // Bottom row

    // Horizontal lines
    const ys = [
      boxY + r1,
      boxY + r1 + r2,
      boxY + r1 + r2 + r3,
      boxY + r1 + r2 + r3 + r4,
      boxY + r1 + r2 + r3 + r4 + r5,
      boxY + r1 + r2 + r3 + r4 + r5 + r6,
      boxY + r1 + r2 + r3 + r4 + r5 + r6 + r7,
    ];
    ys.forEach(y => doc.line(boxX, y, boxX + boxW, y));

    // --- Row 1: Payment Voucher No. ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const voucherNoText = `Payment Voucher No. ...................... ${voucher.voucherNumber} Cash / Cheque`;
    doc.text(voucherNoText, leftX + 3, boxY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Cash / Cheque', rightX + rightColW / 2, boxY + 6.5, { align: 'center' });

    // --- Row 2: Head + Amount ---
    const row2Y = boxY + r1;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Head :', leftX + 3, row2Y + 5.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('(To be filled by office)', leftX + 3, row2Y + 9.5);

    const headValue = drLines[0]?.ledgerName || (voucher.narration || '').split('-')[0].trim() || 'N/A';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(headValue, leftX + 64, row2Y + 8, { maxWidth: leftW - 32 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('AMOUNT', rightX + 5, row2Y + 5.5);
    
    doc.setFontSize(11);
    doc.text(String(Number(amount).toFixed(2)), rightX + rightColW - 5, row2Y + 9, { align: 'right' });

    // --- Row 3: Details of Expenses ---
    const row3Y = boxY + r1 + r2;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Details of', leftX + 3, row3Y + 5.5);
    doc.text('Expenses', leftX + 3, row3Y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const detailsText = voucher.narration || `Amount paid to ${partyName} via ${instrumentType}.`;
    doc.text(detailsText, leftX + 28, row3Y + 8, { maxWidth: leftW - 32 });

    // --- Row 4: Name of Co./Firm + Bill No. + Date ---
    const row4Y = boxY + r1 + r2 + r3;

    // Column widths for row 4
    const nameOfCoW = 100;
    const billNoW = 50;
    const dateW = leftW - nameOfCoW - billNoW;

    const nameOfCoX = leftX;
    const billNoX = leftX + nameOfCoW;
    const dateX = billNoX + billNoW;

    // Vertical lines for row 4
    doc.line(billNoX, row4Y, billNoX, row4Y + r4);
    doc.line(dateX, row4Y, dateX, row4Y + r4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Name of Co.', nameOfCoX + 3, row4Y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const displayName = partyName.length > 35 ? partyName.substring(0, 35) + '...' : partyName;
    doc.text('------------------------', nameOfCoX + 28, row4Y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Bill NO.', billNoX + 3, row4Y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.text('----------', billNoX + 20, row4Y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Date :', dateX + 3, row4Y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.text('---/---/---', dateX + 16, row4Y + 6.5);

    // --- Row 5: Passed By ---
    const row5Y = boxY + r1 + r2 + r3 + r4;

    const passLabelW = 34;
    doc.line(leftX + passLabelW, row5Y, leftX + passLabelW, row5Y + r5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Passed By', leftX + 3, row5Y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Name :', leftX + passLabelW + 3, row5Y + 5);
    doc.text('Signature', leftX + passLabelW + 3, row5Y + 15);

    // AMOUNT PAID label in right column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('AMOUNT PAID', rightX + 5, row5Y + 7);

    // Bottom signatures for Passed By row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const sig1X = leftX + passLabelW + (leftW - passLabelW) * 0.20;
    const sig2X = leftX + passLabelW + (leftW - passLabelW) * 0.50;
    const sig3X = leftX + passLabelW + (leftW - passLabelW) * 0.78;
    
    
    // --- Row 6: Approved by ---
    const row6Y = row5Y + r5;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Approved by', leftX + 3, row6Y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('------------------', leftX + leftW / 2, row6Y + r6 - 5, { align: 'center' });

    // --- Row 7: Paid by ---
    const row7Y = row6Y + r6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Paid by', leftX + 3, row7Y + 6);
        doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('------------------', leftX + leftW / 2, row7Y + r7 - 5, { align: 'center' });

    // --- Row 8: Bottom row (Cash/Cheque, Date, Amount) ---
    const row8Y = row7Y + r7;

    // Three columns in bottom row
    const col1W = 100;
    const col2W = 60;
    const col3W = boxW - col1W - col2W;

    const col1X = boxX;
    const col2X = boxX + col1W;
    const col3X = col2X + col2W;

    doc.line(col2X, row8Y, col2X, row8Y + r8);
    doc.line(col3X, row8Y, col3X, row8Y + r8);

    // Labels at bottom
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Cash/ Cheque', col1X + 4, row8Y + r8 -12);
    // doc.text('Rupees:', col1X + 4, row8Y + r8 - 4);
    doc.setFontSize(9.5);
    doc.text(`Rupees: ${toINRWords(amount)} Only`, boxX + 4, boxY + boxH -4);
    doc.text('Date', col2X + col2W / 2, row8Y + r8 - 4, { align: 'center' });
    
    doc.text('Amount', col3X + col3W - 4, row8Y + r8 - 4, { align: 'right' });

    // Save
    doc.save(`Payment-${voucher.voucherNumber}.pdf`);
  };

  return { downloadPaymentVoucherPdf };
}