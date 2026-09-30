// services/tallySync.service.ts
export interface JournalVoucher {
  _id: string;
  voucherNumber: string;
  date: string;
  voucherType: 'Journal';
  entries: {
    ledgerName: string;
    debitCredit: 'Dr' | 'Cr';
    amount: number;
  }[];
  narration: string;
  isBalanced: boolean;
}
export interface PaymentVoucher {
  _id: string;
  voucherNumber: string;
  date: string; // ISO
  voucherType: 'Payment';

  cashBankLedgerName: string; // credit ledger
  instrumentType: string;
  instrumentNumber?: string | null;
  instrumentDate?: string | null;
  recoDate?: string | null;

  entries: {
    ledgerName: string;
    debitCredit: 'Dr' | 'Cr';
    amount: number;
  }[];

  narration: string;
  totalAmount: number;
  tallyIntegration: boolean;
}
export interface Ledger {
  _id: string;
  ledgerName: string;
  aliases: {
    alias1: string;
    alias2: string;
    alias3: string;
    alias4: string;
  };
  groupName: string;
  creditPeriod: number;
  address?: {
    line1: string;
    line2: string;
    line3: string;
    line4: string;
    country: string;
    state: string;
    pincode: string;
  };
  contactDetails?: {
    contactPerson: string;
    phoneNo: string;
    mobileNo: string;
    faxNo: string;
    email: string;
    emailCC: string;
    website: string;
  };
  taxDetails?: {
    panNo: string;
    gstin: string;
    gstRegType: string;
    gstApplicationFrom: string;
    serviceTaxNo: string;
    vatTinNo: string;
    cstNo: string;
    vatRegType: string;
  };
  openingBalance?: {
    amount: number;
    drCr: 'Dr' | 'Cr';
    billName: string;
    billDate: string;
  };
  currentBalance: number;
  isActive: boolean;
  tallyIntegration: boolean;
  tallyIntegrationDate: string | null;
}

export interface TallyJournalEntry {
  'Voucher Number': string;
  Date: string;
  'Voucher Type': string;
  'Ledger Name': string;
  'Debit / Credit': 'Dr' | 'Cr';
  Amount: number;
  Narration: string;
}

export interface TallyLedgerEntry {
  'Ledger Name': string;
  Alias1: string;
  Alias2: string;
  Alias3: string;
  Alias4: string;
  'Group Name': string;
  'Credit Period': number;
  'Address Line 1': string;
  'Address Line 2': string;
  'Address Line 3': string;
  'Address Line 4': string;
  Country: string;
  State: string;
  Pincode: string;
  'Contact Person': string;
  'Phone No': string;
  'Mobile No': string;
  'Fax No': string;
  Email: string;
  'Email CC': string;
  Website: string;
  'PAN No': string;
  GSTIN: string;
  'GST Reg Type': string;
  'GST Application From': string;
  'Service Tax No': string;
  'VAT Tin No': string;
  'CST No': string;
  'VAT Reg Type': string;
  'Opening Balance': number;
  'Dr / Cr': string;
  'Bill Name': string;
  'Bill Date': string;
}
export interface TallyPaymentVoucherEntry {
  'Voucher Date': string; // ISO or DD-MM-YYYY depending on template, we'll send ISO
  'Voucher Number': string | number;
  'Voucher Type': 'Payment';
  'Cash/Bank Ledger': string;
  'Debit Ledgers': string;
  Amount: number;
  'Instrument Type': string;
  'Instrument Number'?: string | number;
  'Instrument Date'?: string;
  'Reco Date'?: string;
  Narration: string;
}
// Sync Journal Vouchers to Tally
export const syncJournalVouchersToTally = async () => {
  try {
    // Step 1: Fetch vouchers where tallyIntegration is false
    const response = await fetch('/api/journal-voucher/unsynced', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch unsynced vouchers');
    }

    const { data: vouchers } = await response.json();

    if (!vouchers || vouchers.length === 0) {
      return { success: true, message: 'No vouchers to sync', synced: 0 };
    }

    // Step 2: Transform and sync each voucher to Tally
    const syncResults = await Promise.allSettled(
      vouchers.map((voucher: JournalVoucher) => syncSingleJournalVoucher(voucher))
    );

    const successCount = syncResults.filter(r => r.status === 'fulfilled').length;
    const failureCount = syncResults.filter(r => r.status === 'rejected').length;

    return {
      success: true,
      message: `Synced ${successCount} vouchers successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      synced: successCount,
      failed: failureCount,
    };
  } catch (error: any) {
    console.error('Tally sync error:', error);
    throw new Error(error.message || 'Failed to sync vouchers to Tally');
  }
};

// Sync Ledgers to Tally
export const syncLedgersToTally = async () => {
  try {
    // Step 1: Fetch ledgers where tallyIntegration is false
    const response = await fetch('/api/ledger/unsynced', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch unsynced ledgers');
    }

    const { data: ledgers } = await response.json();

    if (!ledgers || ledgers.length === 0) {
      return { success: true, message: 'No ledgers to sync', synced: 0 };
    }

    // Step 2: Transform and sync each ledger to Tally
    const syncResults = await Promise.allSettled(
      ledgers.map((ledger: Ledger) => syncSingleLedger(ledger))
    );

    const successCount = syncResults.filter(r => r.status === 'fulfilled').length;
    const failureCount = syncResults.filter(r => r.status === 'rejected').length;

    return {
      success: true,
      message: `Synced ${successCount} ledgers successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      synced: successCount,
      failed: failureCount,
    };
  } catch (error: any) {
    console.error('Tally ledger sync error:', error);
    throw new Error(error.message || 'Failed to sync ledgers to Tally');
  }
};

// ✅ Sync Payment Vouchers to Tally
export const syncPaymentVouchersToTally = async () => {
  try {
  
    // fallback: if not provided, fetch unsynced from backend
      const response = await fetch('/api/payment-voucher/unsynced', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch unsynced payment vouchers');

    const { data: vouchers } = await response.json();
if (!vouchers || vouchers.length === 0) {
      return { success: true, message: 'No vouchers to sync', synced: 0 };
    }

    const syncResults = await Promise.allSettled(
      vouchers.map((v: any) => syncSinglePaymentVoucher(v)) // your existing function
    );

    const successCount = syncResults.filter(r => r.status === 'fulfilled').length;
    const failureCount = syncResults.filter(r => r.status === 'rejected').length;

    return {
      success: true,
      message: `Synced ${successCount} vouchers successfully${failureCount ? `, ${failureCount} failed` : ''}`,
      synced: successCount,
      failed: failureCount,
    };
  } catch (error: any) {
    console.error('Payment tally sync error:', error);
    throw new Error(error.message || 'Failed to sync payment vouchers to Tally');
  }
};

export const syncSinglePaymentVoucher = async (voucher: PaymentVoucher) => {
  // 1️⃣ Validate entries: must be balanced + exactly one Cr
  const totalDr = voucher.entries
    .filter(e => e.debitCredit === 'Dr')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalCr = voucher.entries
    .filter(e => e.debitCredit === 'Cr')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  if (Math.abs(totalDr - totalCr) > 0.01) {
    throw new Error(`Payment voucher not balanced: Dr ${totalDr} ≠ Cr ${totalCr}`);
  }

  const creditLines = voucher.entries.filter(e => e.debitCredit === 'Cr');
  if (creditLines.length !== 1) {
    throw new Error('Payment voucher must have exactly one Credit entry (Cash/Bank).');
  }

  const creditLedgerName = (creditLines[0]?.ledgerName || '').trim();
  const cashBankName = (voucher.cashBankLedgerName || '').trim();

  if (!cashBankName) throw new Error('cashBankLedgerName missing in voucher.');

  if (creditLedgerName !== cashBankName) {
    throw new Error(
      `Credit ledger "${creditLedgerName}" must match cash/bank ledger "${cashBankName}".`
    );
  }

  // 2️⃣ Find party (Debit Ledgers) - pick first Dr ledger (common case)
  const debitLines = voucher.entries.filter(e => e.debitCredit === 'Dr');
  if (debitLines.length < 1) {
    throw new Error('Payment voucher must have at least one Debit entry (Paid To).');
  }

  // If multiple Dr lines exist, API2Books "Debit Ledgers" is a single string.
  // We'll join them with comma to keep info rather than losing it.
  const debitLedgersName = debitLines.map(d => d.ledgerName).join(', ');

  // 3️⃣ Transform to API2Books PaymentVoucher body (ONE row per voucher)
  const tallyBodyRow: TallyPaymentVoucherEntry = {
    'Voucher Date': toISODate(voucher.date), // "YYYY-MM-DD"
    'Voucher Number': voucher.voucherNumber,
    'Voucher Type': 'Payment',
    'Cash/Bank Ledger': cashBankName,
    'Debit Ledgers': debitLedgersName,
    Amount: Number(voucher.totalAmount ?? totalDr),
    'Instrument Type': voucher.instrumentType,
    Narration: voucher.narration || '',
  };

  // Optional fields only if present
  if (voucher.instrumentNumber) tallyBodyRow['Instrument Number'] = voucher.instrumentNumber;
  if (voucher.instrumentDate) tallyBodyRow['Instrument Date'] = toISODate(voucher.instrumentDate);
  if (voucher.recoDate) tallyBodyRow['Reco Date'] = toISODate(voucher.recoDate);


  // 4️⃣ Send to Next.js proxy (your new route)
  const response = await fetch('/api/tally/sync-payment-voucher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: [tallyBodyRow] }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Tally payment error: ${JSON.stringify(err)}`);
  }

  // OPTIONAL: mark voucher synced (implement this route in backend)
  await fetch(`/api/payment-voucher/${voucher._id}/mark-synced`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tallyIntegration: true, tallyIntegrationDate: new Date().toISOString() }),
  });

  return { success: true };
};

export const syncSingleJournalVoucher = async (voucher: JournalVoucher) => {
  // 1️⃣ Safety: Journal must be balanced
  const totalDr = voucher.entries
    .filter(e => e.debitCredit === 'Dr')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCr = voucher.entries
    .filter(e => e.debitCredit === 'Cr')
    .reduce((sum, e) => sum + e.amount, 0);

  if (totalDr !== totalCr) {
    throw new Error(`Voucher not balanced: Dr ${totalDr} ≠ Cr ${totalCr}`);
  }

  // 2️⃣ Transform to Tally-safe body (same as Food example)
  const tallyEntries = voucher.entries.map(entry => ({
    'Voucher Number': voucher.voucherNumber,
    Date: formatDateForTally(voucher.date),
    'Voucher Type': 'Journal',
    'Ledger Name': entry.ledgerName, // ❗ NOT CHANGED
    'Debit / Credit': entry.debitCredit,
    Amount: entry.amount,
    Narration: voucher.narration,
  }));
  // 3️⃣ Send to Next.js proxy
  const response = await fetch('/api/tally/sync-journal-voucher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: tallyEntries }),
  });
console.log("response", response);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Tally error: ${JSON.stringify(err)}`);
  }

  return { success: true };
};

const syncSingleLedger = async (ledger: Ledger) => {
  // Transform ledger data to Tally format
  const tallyLedger: TallyLedgerEntry = {
    'Ledger Name': ledger.ledgerName,
    Alias1: ledger.aliases?.alias1 || '',
    Alias2: ledger.aliases?.alias2 || '',
    Alias3: ledger.aliases?.alias3 || '',
    Alias4: ledger.aliases?.alias4 || '',
    'Group Name': ledger.groupName,
    'Credit Period': ledger.creditPeriod || 0,
    'Address Line 1': ledger.address?.line1 || '',
    'Address Line 2': ledger.address?.line2 || '',
    'Address Line 3': ledger.address?.line3 || '',
    'Address Line 4': ledger.address?.line4 || '',
    Country: ledger.address?.country || '',
    State: ledger.address?.state || '',
    Pincode: ledger.address?.pincode || '',
    'Contact Person': ledger.contactDetails?.contactPerson || '',
    'Phone No': ledger.contactDetails?.phoneNo || '',
    'Mobile No': ledger.contactDetails?.mobileNo || '',
    'Fax No': ledger.contactDetails?.faxNo || '',
    Email: ledger.contactDetails?.email || '',
    'Email CC': ledger.contactDetails?.emailCC || '',
    Website: ledger.contactDetails?.website || '',
    'PAN No': ledger.taxDetails?.panNo || '',
    GSTIN: ledger.taxDetails?.gstin || '',
    'GST Reg Type': ledger.taxDetails?.gstRegType || '',
    'GST Application From': ledger.taxDetails?.gstApplicationFrom || '',
    'Service Tax No': ledger.taxDetails?.serviceTaxNo || '',
    'VAT Tin No': ledger.taxDetails?.vatTinNo || '',
    'CST No': ledger.taxDetails?.cstNo || '',
    'VAT Reg Type': ledger.taxDetails?.vatRegType || '',
    'Opening Balance': ledger.openingBalance?.amount || 0,
    'Dr / Cr': ledger.openingBalance?.drCr || '',
    'Bill Name': ledger.openingBalance?.billName || '',
    'Bill Date': ledger.openingBalance?.billDate || '',
  };

  // Use Next.js API route as proxy to avoid CORS
  const tallyResponse = await fetch('/api/tally/sync-ledger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ledger: tallyLedger,
    }),
  });

  if (!tallyResponse.ok) {
    const errorData = await tallyResponse.json().catch(() => ({}));
    throw new Error(`Tally API error: ${tallyResponse.status} - ${JSON.stringify(errorData)}`);
  }

  // Update ledger as synced
  await fetch(`/api/ledger/${ledger._id}/mark-synced`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tallyIntegration: true,
      tallyIntegrationDate: new Date().toISOString(),
    }),
  });

  return { ledgerId: ledger._id, success: true };
};

const formatDateForTally = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}${month}${day}`; // ✅ YYYYMMDD
};

// Helper: ensure ISO yyyy-mm-dd
const toISODate = (dateInput: string) => {
  const d = new Date(dateInput);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};









