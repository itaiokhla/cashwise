'use client';
import React, { useMemo, useState } from 'react';
import {
  useCreateJournalVoucherMutation,
  useGetJournalVouchersQuery,
  useUpdateJournalVoucherMutation,
  useDeleteJournalVoucherMutation,
} from '@app/_api_query/journalVoucher.api';
import { useGetLedgersQuery } from '@app/_api_query/ledger.api';
import Sidebar from '@app/_components/Sidebar';
import { toast } from 'react-toastify';
import { syncJournalVouchersToTally } from '@/services/tallySync.service';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LuRefreshCcw,
  LuSearch,
  LuPlus,
  LuX,
  LuTrash2,
  LuDownload,
  LuFilter,
  LuCalendar,
  LuFileText,
  LuEyeOff,
} from 'react-icons/lu';
import { useJournalVoucherPdf } from '@/hooks/useJournalVoucherPdf';
import { LucideEdit } from 'lucide-react';

const CREATED_STATUS = 'Voucher created';
const CANCELLED_STATUS = 'Cancelled';

const JournalVoucherPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [entries, setEntries] = useState([
    {
      ledgerName: '',
      debitCredit: 'Dr',
      amount: 0,
      description: '', // New field for Dr
      remarks: ''      // New field for Cr (will be hidden for Dr)
    },
    {
      ledgerName: '',
      debitCredit: 'Cr',
      amount: 0,
      description: '', // Will be hidden for Cr
      remarks: ''      // New field for Cr
    },
  ]);

  // RTK Query hooks
  const { data: vouchersData, isLoading, error, refetch } = useGetJournalVouchersQuery({
    voucherNumber: searchTerm,
    fromDate,
    toDate,
  });
  const { data: ledgersData } = useGetLedgersQuery({});
  const ledgers = ledgersData?.data || [];
  const [createVoucher, { isLoading: isCreating }] = useCreateJournalVoucherMutation();
  const [updateVoucher, { isLoading: isUpdating }] = useUpdateJournalVoucherMutation();
  const [deleteVoucher, { isLoading: isDeleting }] = useDeleteJournalVoucherMutation();
  const vouchers = useMemo(() => vouchersData?.data || [], [vouchersData]);

  // PDF hook
  const { downloadJournalVoucherPdf } = useJournalVoucherPdf();

  // Counts for tabs (excluding cancelled)
  const counts = useMemo(() => {
    const all = vouchers.filter((v: any) => v.status !== CANCELLED_STATUS).length;
    const synced = vouchers.filter((v: any) => v.tallyIntegration === true && v.status !== CANCELLED_STATUS).length;
    const notSynced = vouchers.filter((v: any) => v.tallyIntegration !== true && v.status !== CANCELLED_STATUS).length;
    const created = vouchers.filter((v: any) => v.status === CREATED_STATUS && v.status !== CANCELLED_STATUS).length;
    const notCreated = vouchers.filter((v: any) => v.status !== CREATED_STATUS && v.status !== CANCELLED_STATUS).length;
    return { all, synced, notSynced, created, notCreated };
  }, [vouchers]);

  // Filter vouchers based on active tab (exclude cancelled)
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher: any) => {
      // Always exclude cancelled vouchers
      if (voucher.status === CANCELLED_STATUS) return false;
      
      if (activeTab === 'all') return true;
      if (activeTab === 'synced') return voucher.tallyIntegration === true;
      if (activeTab === 'not-synced') return voucher.tallyIntegration !== true;
      if (activeTab === 'voucher-created') return voucher.status === CREATED_STATUS;
      if (activeTab === 'voucher-not-created') return voucher.status !== CREATED_STATUS;
      return true;
    });
  }, [vouchers, activeTab]);

  // Totals
  const totals = useMemo(() => {
    const debit = entries
      .filter((e: any) => e.debitCredit === 'Dr')
      .reduce((sum: any, e: any) => sum + Number(e.amount || 0), 0);
    const credit = entries
      .filter((e: any) => e.debitCredit === 'Cr')
      .reduce((sum: any, e: any) => sum + Number(e.amount || 0), 0);
    return { debit, credit, difference: Math.abs(debit - credit) };
  }, [entries]);

  const handleAddEntry = () => {
    setEntries([...entries, {
      ledgerName: '',
      debitCredit: 'Dr',
      amount: 0,
      description: '',
      remarks: ''
    }]);
  };

  const handleRemoveEntry = (index: number) => {
    if (entries.length > 2) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const handleEntryChange = (index: number, field: string, value: any) => {
    const newEntries: any[] = [...entries];
    newEntries[index][field] = value;
    // Smart field management: clear opposite field when switching Dr/Cr
    if (field === 'debitCredit') {
      if (value === 'Dr') {
        newEntries[index].remarks = ''; // Clear remarks for Dr
      } else {
        newEntries[index].description = ''; // Clear description for Cr
      }
    }
    setEntries(newEntries);
  };

  const handleCreateVoucher = async () => {
    if (!narration.trim()) {
      toast.error('Narration is required!');
      return;
    }
    if (entries.length < 2) {
      toast.error('At least 2 entries are required!');
      return;
    }
    if (totals.difference > 0.01) {
      toast.error('Voucher is not balanced! Debit must equal Credit.');
      return;
    }
    // Validate all entries have ledger names
    const invalidEntry = entries.find((e: any) =>
      !e.ledgerName ||
      e.amount <= 0 ||
      (e.debitCredit === 'Dr' && (!e.description || !e.description.trim())) ||
      (e.debitCredit === 'Cr' && (!e.remarks || !e.remarks.trim()))
    );
    if (invalidEntry) {
      toast.error(`All entries must have valid ledger, amount > 0, and ${invalidEntry.debitCredit === 'Dr' ? 'description' : 'remarks'}`);
      return;
    }
    try {
      const result = await createVoucher({
        date,
        entries,
        narration: narration.trim(),
      }).unwrap();
      toast.success(result.message || 'Journal voucher created successfully!');
      handleCloseModal();
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to create voucher');
    }
  };

  const handleUpdateVoucher = async () => {
    if (!narration.trim()) {
      toast.error('Narration is required!');
      return;
    }
    if (totals.difference > 0.01) {
      toast.error('Voucher is not balanced! Debit must equal Credit.');
      return;
    }
    // Validate all entries
    const invalidEntry = entries.find((e: any) =>
      !e.ledgerName ||
      e.amount <= 0 ||
      (e.debitCredit === 'Dr' && (!e.description || !e.description.trim())) ||
      (e.debitCredit === 'Cr' && (!e.remarks || !e.remarks.trim()))
    );
    if (invalidEntry) {
      toast.error(`All entries must have valid ledger, amount > 0, and ${invalidEntry.debitCredit === 'Dr' ? 'description' : 'remarks'}`);
      return;
    }
    try {
      const result = await updateVoucher({
        _id: editingVoucher._id,
        date,
        entries,
        narration: narration.trim(),
      }).unwrap();
      toast.success(result.message || 'Journal voucher updated successfully!');
      handleCloseModal();
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to update voucher');
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    if (!confirm('Are you sure you want to delete this voucher? This action cannot be undone.')) return;
    try {
      const result = await deleteVoucher(id).unwrap();
      toast.success(result.message || 'Voucher deleted successfully!');
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to delete voucher');
    }
  };

  const handleEditClick = (voucher: any) => {
    setEditingVoucher(voucher);
    setDate(new Date(voucher.date).toISOString().split('T')[0]);
    setNarration(voucher.narration);
    // FIXED: Populate description and remarks when editing
    setEntries(
      voucher.entries.map((e: any) => ({
        ledgerName: e.ledgerName,
        debitCredit: e.debitCredit,
        amount: e.amount,
        description: e.description || '', // FIXED: Add description
        remarks: e.remarks || ''         // FIXED: Add remarks
      }))
    );
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingVoucher(null);
    setDate(new Date().toISOString().split('T')[0]);
    setNarration('');
    setEntries([
      {
        ledgerName: '',
        debitCredit: 'Dr',
        amount: 0,
        description: '',
        remarks: ''
      },
      {
        ledgerName: '',
        debitCredit: 'Cr',
        amount: 0,
        description: '',
        remarks: ''
      },
    ]);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingVoucher(null);
  };

  const handleSubmit = () => {
    if (editingVoucher) handleUpdateVoucher();
    else handleCreateVoucher();
  };

  // Sync vouchers to Tally
  const handleTallySyncSelected = async () => {
    if (activeTab !== 'not-synced') {
      toast.info('Please switch to "Not Synced" tab to sync vouchers.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncJournalVouchersToTally();
      toast.success(result.message);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync vouchers');
    } finally {
      setIsSyncing(false);
    }
  };

  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'synced', label: 'Synced', count: counts.synced },
    { id: 'not-synced', label: 'Not Synced', count: counts.notSynced },
  ];

  return (
    <div className="flex  bg-gray-50">
      <Sidebar />
      <div className="flex-1">
        <div className="w-full px-3  max-w-7xl mx-auto py-4 sm:py-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm px-4 sm:px-6 md:px-8 py-4 sm:py-6 mb-4"
          >
            {/* <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-1">
                  Journal Vouchers
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">Manage and sync your journal vouchers</p>
              </div>
              <button
                onClick={handleAddClick}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all text-sm"
              >
                <LuPlus className="text-base sm:text-lg" />
                <span>Add Voucher</span>
              </button>
            </div> */}
            {/* Search & Filter Toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search voucher number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <LuFilter className="text-base sm:text-lg" />
                <span className="hidden xs:inline">Filters</span>
              </button>
            </div>
            {/* Date Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 overflow-hidden"
                >
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">From Date</label>
                    <div className="relative">
                      <LuCalendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">To Date</label>
                    <div className="relative">
                      <LuCalendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bulk Actions */}
          {/* <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm px-4 py-3 sm:px-6 sm:py-4 mb-4"
          >
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Sync Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTallySyncSelected}
                disabled={activeTab !== 'not-synced' || isSyncing}
                className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm transition-all text-xs sm:text-sm"
              >
                <motion.span
                  animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 1, repeat: isSyncing ? Infinity : 0, ease: 'linear' }}
                >
                  <LuRefreshCcw className="text-base sm:text-lg" />
                </motion.span>
                <span>{isSyncing ? 'Syncing...' : 'Sync to Tally'}</span>
              </motion.button>
            </div>
          </motion.div> */}

          {/* Tabs */}
          {/* <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden"
          >
            <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600 bg-purple-50'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1.5 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs ${
                      activeTab === tab.id ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </motion.div> */}

          {/* Vouchers List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-sm overflow-hidden"
          >
            {isLoading ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="inline-block h-8 w-8 sm:h-10 sm:w-10 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
                <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600">Loading vouchers...</p>
              </div>
            ) : error ? (
              <div className="p-8 sm:p-12 text-center text-red-600 text-xs sm:text-sm">
                Error loading vouchers. Please try again.
              </div>
            ) : filteredVouchers.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <LuFileText className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mb-3 sm:mb-4" />
                <p className="text-gray-500 text-base sm:text-lg mb-3 sm:mb-4">No vouchers found</p>
                <button
                  onClick={handleAddClick}
                  className="mt-3 sm:mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm"
                >
                  Create your first voucher
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto max-h-[60vh]">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Voucher No
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Date
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Narration
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Amount
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Sync
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Description (Dr)
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Remarks (Cr)
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredVouchers.map((voucher: any, index: number) => {
                        const drEntries = voucher.entries?.filter((e: any) => e.debitCredit === 'Dr') || [];
                        const crEntries = voucher.entries?.filter((e: any) => e.debitCredit === 'Cr') || [];
                        
                        return (
                          <motion.tr
                            key={voucher._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                              {voucher.voucherNumber}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                              {new Date(voucher.date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 max-w-xs truncate">{voucher.narration}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-semibold text-gray-900">
                              ₹{voucher.totalAmount?.toFixed?.(2) ?? '0.00'}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                  voucher.status === 'Posted'
                                    ? 'bg-green-100 text-green-800'
                                    : voucher.status === 'Draft'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : voucher.status === CREATED_STATUS
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {voucher.status}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                  voucher.tallyIntegration
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {voucher.tallyIntegration ? 'Synced' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 max-w-xs">
                              {drEntries.map((e: any, idx: number) => (
                                <div key={idx} className="text-[10px] sm:text-xs">
                                  {e.description || '-'}
                                </div>
                              ))}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 max-w-xs">
                              {crEntries.map((e: any, idx: number) => (
                                <div key={idx} className="text-[10px] sm:text-xs">
                                {e.remarks || '-'}
                                </div>
                              ))}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                              <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                                <button
                                  onClick={() => downloadJournalVoucherPdf(voucher)}
                                  className="text-green-600 hover:text-green-900 transition-colors"
                                  title="Download PDF"
                                >
                                  <LuDownload className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                                <button
                                  onClick={() => handleEditClick(voucher)}
                                  disabled={voucher.tallyIntegration}
                                  className="text-purple-600 hover:text-purple-900 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                                  title={voucher.tallyIntegration ? 'Cannot edit synced voucher' : 'Edit'}
                                >
                                  <LucideEdit className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteVoucher(voucher._id)}
                                  disabled={voucher.tallyIntegration || isDeleting}
                                  className="text-red-600 hover:text-red-900 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                                  title={voucher.tallyIntegration ? 'Cannot delete synced voucher' : 'Delete'}
                                >
                                  <LuTrash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                  {filteredVouchers.map((voucher: any, index: number) => {
                    const drEntries = voucher.entries?.filter((e: any) => e.debitCredit === 'Dr') || [];
                    const crEntries = voucher.entries?.filter((e: any) => e.debitCredit === 'Cr') || [];
                    
                    return (
                      <motion.div
                        key={voucher._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2 sm:mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                              <span className="text-sm font-bold text-gray-900">{voucher.voucherNumber}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                                  voucher.status === 'Posted'
                                    ? 'bg-green-100 text-green-800'
                                    : voucher.status === 'Draft'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : voucher.status === CREATED_STATUS
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {voucher.status}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">
                              {new Date(voucher.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600">Narration:</span>
                            <span className="font-medium text-gray-900 text-right truncate max-w-[60%]">
                              {voucher.narration}
                            </span>
                          </div>
                          
                          {/* Description (Dr) - Separate heading */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] sm:text-xs font-medium text-gray-600">Description (Dr):</span>
                            <div className="text-[10px] sm:text-xs text-gray-700 space-y-0.5">
                              {drEntries.map((e: any, idx: number) => (
                                <div key={idx} className="truncate">
                               {e.description || '-'}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Remarks (Cr) - Separate heading */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] sm:text-xs font-medium text-gray-600">Remarks (Cr):</span>
                            <div className="text-[10px] sm:text-xs text-gray-700 space-y-0.5">
                              {crEntries.map((e: any, idx: number) => (
                                <div key={idx} className="truncate">
                                  {e.remarks || '-'}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600">Amount:</span>
                            <span className="font-bold text-gray-900">
                              ₹{voucher.totalAmount?.toFixed?.(2) ?? '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600">Tally Sync:</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                                voucher.tallyIntegration
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {voucher.tallyIntegration ? 'Synced' : 'Pending'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={() => downloadJournalVoucherPdf(voucher)}
                            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 bg-green-50 text-green-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium hover:bg-green-100 transition-colors"
                          >
                            <LuDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => handleEditClick(voucher)}
                            disabled={voucher.tallyIntegration}
                            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 bg-purple-50 text-purple-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium hover:bg-purple-100 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <LucideEdit className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteVoucher(voucher._id)}
                            disabled={voucher.tallyIntegration || isDeleting}
                            className="flex items-center justify-center bg-red-50 text-red-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-red-100 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <LuTrash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modal - Mobile First Responsive */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50"
          onClick={handleCloseModal}
        >
          <div 
            className="min-h-screen flex items-center justify-center p-2 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-white">
                  {editingVoucher ? 'Edit Journal Voucher' : 'Create Journal Voucher'}
                </h3>
                <button 
                  onClick={handleCloseModal} 
                  className="text-white hover:text-gray-200 transition-colors p-1 sm:p-2"
                  aria-label="Close modal"
                >
                  <LuX className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
                <div className="space-y-3 sm:space-y-4">
                  {/* Date and Narration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Narration *</label>
                      <input
                        type="text"
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder="Enter narration"
                        className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Entries */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-3 gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-700">Entries</h3>
                      <button
                        onClick={handleAddEntry}
                        className="text-purple-600 hover:text-purple-700 text-xs sm:text-sm font-medium flex items-center gap-1 justify-center px-2 py-1.5 sm:px-3 sm:py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        <LuPlus className="text-base" />
                        <span>Add Entry</span>
                      </button>
                    </div>
                    
                    <div className="space-y-2 sm:space-y-3">
                      {entries.map((entry, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 p-2.5 sm:p-3 rounded-lg border border-gray-200"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr,80px,1fr] md:grid-cols-[1.5fr,90px,1fr,1.5fr] gap-2 sm:gap-3">
                            {/* Ledger */}
                            <div className="sm:col-span-1 md:col-span-1">
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Ledger</label>
                              <select
                                value={entry.ledgerName}
                                onChange={(e) => handleEntryChange(index, 'ledgerName', e.target.value)}
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm"
                              >
                                <option value="">Select Ledger</option>
                                {ledgers.map((ledger: any) => (
                                  <option key={ledger._id} value={ledger.ledgerName}>
                                    {ledger.ledgerName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Dr/Cr */}
                            <div className="sm:col-span-1 md:col-span-1">
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Type</label>
                              <select
                                value={entry.debitCredit}
                                onChange={(e) => handleEntryChange(index, 'debitCredit', e.target.value)}
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm"
                              >
                                <option value="Dr">Dr</option>
                                <option value="Cr">Cr</option>
                              </select>
                            </div>
                            
                            {/* Amount */}
                            <div className="sm:col-span-1 md:col-span-1">
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Amount</label>
                              <input
                                type="number"
                                value={entry.amount}
                                onChange={(e) => handleEntryChange(index, 'amount', e.target.value)}
                                placeholder="Amount"
                                min="0"
                                step="0.01"
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm"
                              />
                            </div>
                            
                            {/* Description/Remarks */}
                            <div className="sm:col-span-2 md:col-span-1">
                              <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">
                                {entry.debitCredit === 'Dr' ? 'Description *' : 'Remarks *'}
                              </label>
                              <input
                                type="text"
                                value={entry.debitCredit === 'Dr' ? entry.description : entry.remarks}
                                onChange={(e) => handleEntryChange(index, entry.debitCredit === 'Dr' ? 'description' : 'remarks', e.target.value)}
                                placeholder={entry.debitCredit === 'Dr' ? 'Enter description' : 'Enter remarks'}
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm"
                              />
                            </div>
                          </div>
                          
                          {/* Remove button - full width on mobile */}
                          {entries.length > 2 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => handleRemoveEntry(index)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs sm:text-sm font-medium"
                              >
                                <LuTrash2 className="text-base" />
                                Remove Entry
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                      <div>
                        <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Total Debit</p>
                        <p className="text-sm sm:text-base font-bold text-gray-900">₹{totals.debit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Total Credit</p>
                        <p className="text-sm sm:text-base font-bold text-gray-900">₹{totals.credit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Difference</p>
                        <p
                          className={`text-sm sm:text-base font-bold ${
                            totals.difference > 0.01 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          ₹{totals.difference.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {totals.difference > 0.01 && (
                      <p className="text-center text-red-600 text-[10px] sm:text-xs mt-1.5 sm:mt-2 font-medium">
                        ⚠️ Voucher is not balanced!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  disabled={isCreating || isUpdating}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-gray-300 shadow-sm px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={totals.difference > 0.01 || isCreating || isUpdating}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-600 text-xs sm:text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating || isUpdating ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                      Saving...
                    </span>
                  ) : editingVoucher ? (
                    'Update Voucher'
                  ) : (
                    'Create Voucher'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalVoucherPage;