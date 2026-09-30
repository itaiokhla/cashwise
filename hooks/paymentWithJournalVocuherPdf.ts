'use client';

import { jsPDF } from 'jspdf';

type DrCr = 'Dr' | 'Cr';

export type VoucherEntry = {
  ledgerName: string;
  debitCredit: DrCr;
  amount: number;
  description?: string;  // For Debit entries - party/vendor description
  remarks?: string;      // For Credit entries - payment remarks
};

export type PaymentVoucher = {
  voucherNumber: string;
  date: string | Date;
  voucherType: 'Payment';
  cashBankLedgerName: string;      // Cash/Bank account being credited
  instrumentType: string;          // Cash, Cheque, NEFT, RTGS, UPI, etc.
  instrumentNumber?: string;       // Cheque no, UTR, etc.
  instrumentDate?: string | Date;  // Date of instrument
  recoDate?: string | Date;        // Reconciliation date
  entries: VoucherEntry[];
  narration?: string;
  totalAmount?: number;
};

type OrgInfo = {
  name?: string;
  address?: string;
};

const DEFAULT_ORG: Required<OrgInfo> = {
  name: "INTER-TECH",
  address: "B-83, Flatted Factory Complex, Okhla Phase3, New Delhi-110020",
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDateDDMMYY = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const toINRWords = (num: number) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords2 = (n: number) => {
    if (n < 20) return a[n];
    return `${b[Math.floor(n / 10)]}${n % 10 ? ' ' + a[n % 10] : ''}`.trim();
  };

  const inWords3 = (n: number) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundred ? a[hundred] + ' Hundred' : ''}${rest ? (hundred ? ' ' : '') + inWords2(rest) : ''}`.trim();
  };

  const n = Math.round(num);
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
    // A4 Portrait
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PW = doc.internal.pageSize.getWidth();  // 210
    const PH = doc.internal.pageSize.getHeight(); // 297

    const margin = 10;
    const leftStripW = 24;
    const mainX = margin + leftStripW;
    const mainW = PW - margin - mainX;

    // Outer border
    doc.setLineWidth(0.4);
    doc.rect(margin, margin, PW - margin * 2, PH - margin * 2);
    
    // Vertical separator for left strip
    doc.line(mainX, margin, mainX, PH - margin);

    // ========== LEFT STRIP (vertical text) ==========
    const stripCenterX = margin + leftStripW / 2;
    const stripStartY = margin + 20;
    
    // Vertical dotted line divider in the middle of left strip
    const dividerX = stripCenterX + 1;
    doc.setLineWidth(0.2);
    doc.line(dividerX, margin, dividerX, PH - margin);
    doc.setLineWidth(0.3);
    
    // "On A/c. of" text (left side of divider)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('On A/c. of', stripCenterX - 4, stripStartY - 18, { angle: 270 });
    
    // Write narration after "On A/c. of"
    if (voucher.narration) {
      doc.setFontSize(8);
      // Split narration into multiple lines if too long
      const splitNarration = doc.splitTextToSize(voucher.narration, PH - margin * 2 - 40);
      doc.text(splitNarration, stripCenterX - 4, stripStartY, { angle: 270 });
    }
    
    // "PAID the sum of Rupees..." (right side of divider) - Payment Voucher specific
    doc.setFontSize(8);
    doc.text('PAID the sum of Rupees', stripCenterX + 6, stripStartY - 18, { 
      angle: 270
    });
    
    // Write amount in words after "Rupees"
    const amountInWords = toINRWords(voucher.totalAmount || 0);
    doc.setFontSize(7);
    const splitAmountWords = doc.splitTextToSize(amountInWords, PH - margin * 2 - 40);
    // doc.text(splitAmountWords, stripCenterX + 6, stripStartY + 10, { angle: 270 });

    // ========== HEADER ==========
    const headerY = margin + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(orgInfo.name, mainX + mainW / 2, headerY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(orgInfo.address, mainX + mainW / 2, headerY + 6, { align: 'center' });

    // ========== PAYMENT VOUCHER TITLE ==========
    const titleY = headerY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    // doc.text('PAYMENT VOUCHER', mainX + mainW / 2, titleY, { align: 'center' });

    // ========== VOUCHER NO & DATE LINE ==========
    const voucherLineY = titleY + 8;
    doc.setLineWidth(0.3);
    doc.line(mainX, voucherLineY, mainX + mainW, voucherLineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    // doc.text(`Voucher No. ${voucher.voucherNumber}`, mainX + 3, voucherLineY + 5);
    doc.text(`Date: ${formatDateDDMMYY(voucher.date)}`, mainX + mainW - 55, voucherLineY + 5);

    // ========== INSTRUMENT DETAILS ==========
    const instrumentY = voucherLineY + 10;
    doc.setFontSize(9);
    
    // Cash/Bank Ledger
    // doc.text(`Cash/Bank: ${voucher.cashBankLedgerName}`, mainX + 3, instrumentY);
    
    // Instrument Type and Number
    let instrumentInfo = `Instrument: ${voucher.instrumentType}`;
    if (voucher.instrumentNumber) {
      instrumentInfo += ` | No: ${voucher.instrumentNumber}`;
    }
    // doc.text(instrumentInfo, mainX + mainW - 3, instrumentY, { align: 'right' });
    
    // Instrument Date and Reco Date (if available)
    let dateInfo = '';
    if (voucher.instrumentDate) {
      dateInfo += `Inst. Date: ${formatDateDDMMYY(voucher.instrumentDate)}`;
    }
    if (voucher.recoDate) {
      if (dateInfo) dateInfo += ' | ';
      dateInfo += `Reco Date: ${formatDateDDMMYY(voucher.recoDate)}`;
    }
    // if (dateInfo) {
    //   doc.text(dateInfo, mainX + 3, instrumentY + 5);
    // }

    // ========== TABLE ==========
    const tableX = mainX;
    const tableY = instrumentY + (dateInfo ? 10 : 5);
    const tableW = mainW;
    
    // Column widths
    const labelColW = 30;
    const rsColW = 30;
    const pColW = 10;
    const amountColW = rsColW + pColW;
    const particularColW = tableW - labelColW - amountColW;

    // Calculate entries
    const dr = voucher.entries.filter(e => e.debitCredit === 'Dr');
    const cr = voucher.entries.filter(e => e.debitCredit === 'Cr');

    const totalDr = dr.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalCr = cr.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Row heights
    const headerRowH = 10;
    const dataRowH = 12;
    const totalRowH = 10;
    
    // Calculate table height based on actual entries
    const drDataRows = Math.max(dr.length, 3); // At least 3 rows for debit entries
    const crDataRows = Math.max(cr.length, 2); // At least 2 rows for credit entries (usually 1 for Payment)
    
    const tableH = headerRowH + (drDataRows * dataRowH) + totalRowH + headerRowH + (crDataRows * dataRowH) + totalRowH;

    // Draw table outer border
    doc.setLineWidth(0.3);
    doc.rect(tableX, tableY, tableW, tableH);

    // Vertical lines
    doc.line(tableX + labelColW, tableY, tableX + labelColW, tableY + tableH);
    doc.line(tableX + labelColW + particularColW, tableY, tableX + labelColW + particularColW, tableY + tableH);
    
    // Vertical line between Rs. and P. (only in the header row for AMOUNT section)
    doc.line(tableX + labelColW + particularColW + rsColW, tableY, tableX + labelColW + particularColW + rsColW, tableY + headerRowH);

    // Helper function to write amount with rupees and paise
    const writeAmount = (x: number, y: number, amount: number) => {
      const rupees = Math.floor(amount);
      const paise = Math.round((amount - rupees) * 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(rupees.toString(), x + 2, y);
      doc.text(paise.toString().padStart(2, '0'), x + rsColW + 2, y);
    };

    // ===== DEBIT SECTION =====
    let currentY = tableY;

    // DEBIT header row
    doc.line(tableX, currentY + headerRowH, tableX + tableW, currentY + headerRowH);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DEBIT', tableX + 3, currentY + 7);
    
    // AMOUNT header
    doc.setFontSize(10);
    doc.text('AMOUNT', tableX + labelColW + particularColW + (amountColW / 2), currentY + 4, { align: 'center' });
    
    // Rs. and P. labels with vertical divider
    doc.setFontSize(9);
    doc.text('Rs.', tableX + labelColW + particularColW + (rsColW / 2), currentY + 8, { align: 'center' });
    doc.text('P.', tableX + labelColW + particularColW + rsColW + (pColW / 2), currentY + 8, { align: 'center' });

    currentY += headerRowH;

    // DEBIT data rows with actual entries
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    for (let i = 0; i < drDataRows; i++) {
      if (i < dr.length) {
        const entry: VoucherEntry = dr[i];
        // Write ledger name
        doc.text(entry.ledgerName || '', tableX + labelColW + 2, currentY - 4);
        
        // Write description (for Debit entries)
        if (entry.description) {
          doc.setFontSize(8);
          const splitDesc = doc.splitTextToSize(entry.description, particularColW - 4);
          doc.text(splitDesc, tableX + labelColW + 2, currentY + 8);
          doc.setFontSize(9);
        }
        
        // Write amount
        writeAmount(tableX + labelColW + particularColW, currentY + 4, entry.amount);
      }
      doc.line(tableX, currentY + dataRowH, tableX + tableW, currentY + dataRowH);
      currentY += dataRowH;
    }

    // RUPEES row (DEBIT total)
    doc.line(tableX, currentY + totalRowH, tableX + tableW, currentY + totalRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RUPEES', tableX + 3, currentY + 7);
    doc.text('TOTAL Rs.', tableX + labelColW + particularColW - 25, currentY + 7);
    writeAmount(tableX + labelColW + particularColW, currentY + 7, totalDr);
    currentY += totalRowH;

    // ===== CREDIT SECTION =====
    // CREDIT header row
    doc.line(tableX, currentY + headerRowH, tableX + tableW, currentY + headerRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CREDIT', tableX + 3, currentY + 7);
    currentY += headerRowH;

    // CREDIT data rows with actual entries
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    for (let i = 0; i < crDataRows; i++) {
      if (i < cr.length) {
        const entry: VoucherEntry = cr[i];
        // Write ledger name
        doc.text(entry.ledgerName || '', tableX + labelColW + 2, currentY - 4);
        
        // Write remarks (for Credit entries - Cash/Bank)
        if (entry.remarks) {
          doc.setFontSize(8);
          const splitRemarks = doc.splitTextToSize(entry.remarks, particularColW - 4);
          doc.text(splitRemarks, tableX + labelColW + 2, currentY + 8);
          doc.setFontSize(9);
        }
        
        // Write amount
        writeAmount(tableX + labelColW + particularColW, currentY + 4, entry.amount);
      }
      doc.line(tableX, currentY + dataRowH, tableX + tableW, currentY + dataRowH);
      currentY += dataRowH;
    }

    // RUPEES row (CREDIT total)
    doc.line(tableX, currentY + totalRowH, tableX + tableW, currentY + totalRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RUPEES', tableX + 3, currentY + 7);
    doc.text('TOTAL Rs.', tableX + labelColW + particularColW - 25, currentY + 7);
    writeAmount(tableX + labelColW + particularColW, currentY + 7, totalCr);

    // ========== BOTTOM SECTION (Approved by & Signatures) ==========
    const bottomY = tableY + tableH + 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Approved by: .......................', mainX + 3, bottomY);

    // Signature section
    const sigY = bottomY + 10;
    doc.text('Signature.........................', mainX + 3, sigY);
    doc.text("Receiver's Signature .........................", mainX + mainW - 80, sigY);

    // Save
    doc.save(`${voucher.voucherType}-${voucher.voucherNumber}.pdf`);
  };

  return { downloadPaymentVoucherPdf };
}