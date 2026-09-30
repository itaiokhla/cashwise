'use client';
import React, { useState } from 'react';
import { useGetLedgersQuery, useCreateLedgerMutation, useUpdateLedgerMutation, useDeleteLedgerMutation } from '@app/_api_query/ledger.api';
import Sidebar from '@app/_components/Sidebar';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { LuRefreshCcw, LuSearch, LuPlus, LuX } from 'react-icons/lu';
import { syncLedgersToTally } from '@/services/tallySync.service';
import { LuTrash2 } from 'react-icons/lu';
import { FaEdit } from 'react-icons/fa';

// Define valid group options matching backend expectations
const GROUP_OPTIONS = [
  { value: 'Indirect Expenses', label: 'Indirect Expenses' },
  { value: 'Bank Account', label: 'Bank Account' }
] as const;

type GroupName = typeof GROUP_OPTIONS[number]['value'];

const LedgerPage = () => {
  const [ledgerName, setLedgerName] = useState('');
  const [groupName, setGroupName] = useState<GroupName>('Indirect Expenses'); // Typed state
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLedger, setEditingLedger] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'synced', 'not-synced'

  // RTK Query hooks
  const { data: ledgersData, isLoading, error, refetch } = useGetLedgersQuery({
    ledgerName: searchTerm,
  });

  const [createLedger, { isLoading: isCreating }] = useCreateLedgerMutation();
  const [updateLedger, { isLoading: isUpdating }] = useUpdateLedgerMutation();
  const [deleteLedger, { isLoading: isDeleting }] = useDeleteLedgerMutation();

  const ledgers = ledgersData?.data || [];

  // Filter ledgers based on active tab
  const filteredLedgers = ledgers.filter((ledger: any) => {
    const matchesTab = 
      activeTab === 'all' ? true :
      activeTab === 'synced' ? ledger.tallyIntegration === true :
      activeTab === 'not-synced' ? ledger.tallyIntegration !== true : true;
    return matchesTab;
  });

const handleDeleteLedger = async (ledger: any) => {
  if (!confirm(`Are you sure you want to delete "${ledger.ledgerName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    await deleteLedger(ledger._id).unwrap();
    toast.success(`Ledger "${ledger.ledgerName}" deleted successfully!`);
    refetch(); // Critical: Refresh data after deletion
  } catch (err: any) {
    toast.error(err?.data?.message || `Failed to delete "${ledger.ledgerName}"`);
  }
};

// ENHANCE handleUpdateLedger WITH REFETCH
const handleUpdateLedger = async () => {
  if (!ledgerName.trim()) {
    toast.error('Ledger name is required!');
    return;
  }
  if (!groupName) {
    toast.error('Group name is required!');
    return;
  }

  try {
    const result = await updateLedger({
      _id: editingLedger._id,
      ledgerName: ledgerName.trim(),
      groupName,
    }).unwrap();

    toast.success(result.message || 'Ledger updated successfully!');
    refetch(); // Critical: Refresh data after update
    handleCloseModal();
  } catch (err: any) {
    toast.error(err?.data?.message || 'Failed to update ledger');
  }
};

// ENHANCE handleCreateLedger WITH REFETCH
const handleCreateLedger = async () => {
  if (!ledgerName.trim()) {
    toast.error('Ledger name is required!');
    return;
  }
  if (!groupName) {
    toast.error('Group name is required!');
    return;
  }

  try {
    const result = await createLedger({
      ledgerName: ledgerName.trim(),
      groupName,
    }).unwrap();

    toast.success(result.message || 'Ledger created successfully!');
    refetch(); // Critical: Refresh data after creation
    handleCloseModal();
  } catch (err: any) {
    toast.error(err?.data?.message || 'Failed to create ledger');
  }
};

// UPDATE handleEditClick TO HANDLE GROUP NAME SAFELY
const handleEditClick = (ledger: any) => {
  setEditingLedger(ledger);
  setLedgerName(ledger.ledgerName);
  
  // Validate and set group name - prevents invalid values from breaking select
  const validGroup = GROUP_OPTIONS.find(opt => opt.value === ledger.groupName)?.value || GROUP_OPTIONS[0].value;
  setGroupName(validGroup);
  
  setShowModal(true);
};

  // Open modal for creating
  const handleAddClick = () => {
    setEditingLedger(null);
    setLedgerName('');
    setGroupName(GROUP_OPTIONS[0].value); // Reset to default
    setShowModal(true);
  };

  // Close modal with form reset
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLedger(null);
    setLedgerName('');
    setGroupName(GROUP_OPTIONS[0].value); // Clean reset
  };

  const handleSubmit = () => {
    if (editingLedger) {
      handleUpdateLedger();
    } else {
      handleCreateLedger();
    }
  };

  // Handle Tally Sync
  const handleTallySync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncLedgersToTally();
      toast.success(result.message);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync ledgers');
    } finally {
      setIsSyncing(false);
    }
  };

  // const tabs = [
  //   { id: 'all', label: 'All', count: ledgers.length },
  //   { id: 'synced', label: 'Tally Synced', count: ledgers.filter((l: any) => l.tallyIntegration === true).length },
  //   { id: 'not-synced', label: 'Not Synced', count: ledgers.filter((l: any) => l.tallyIntegration !== true).length },
  // ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 bg-gray-50 ">
        <div className="w-full px-3 py-4  max-w-7xl mx-auto">
          
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm p-4 ">
            {/* Title and Add Button */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                Ledger Management
              </h1>
              <button
                onClick={handleAddClick}
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base shadow-sm"
              >
                <LuPlus className="text-lg" />
                <span>Add Ledger</span>
              </button>
            </div>

            {/* Sync Button */}
            {/* <div className="mb-4 sm:mb-5">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTallySync}
                disabled={isSyncing || activeTab !== 'not-synced'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base disabled:bg-purple-300 disabled:cursor-not-allowed shadow-sm"
              >
                <motion.span 
                  animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 1, repeat: isSyncing ? Infinity : 0, ease: "linear" }}
                >
                  <LuRefreshCcw className="text-lg" />
                </motion.span>
                <span>{isSyncing ? 'Syncing...' : 'Sync with Tally'}</span>
              </motion.button>
            </div> */}

            {/* Search Bar */}
            <div className="relative">
              <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search ledgers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Tabs Section */}
          {/* <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-5 md:mb-6 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600 bg-purple-50'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div> */}

          {/* Ledgers List */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
                <p className="mt-3 text-gray-600 text-sm sm:text-base">Loading ledgers...</p>
              </div>
            ) : error ? (
              <div className="p-8 sm:p-12 text-center text-red-600 text-sm sm:text-base">
                Error loading ledgers. Please try again.
              </div>
            ) : filteredLedgers.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500 text-sm sm:text-base">
                {searchTerm || activeTab !== 'all' ? 'No ledgers found matching your filters.' : 'No ledgers found. Click "Add Ledger" to create one.'}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block lg:hidden divide-y divide-gray-200 max-h-[60vh] overflow-auto">
        {filteredLedgers.map((ledger: any) => (
          <div key={ledger._id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                  {ledger.ledgerName}
                </h3>
                <p className="text-xs sm:text-sm text-purple-600 font-medium mt-1">
                  Group: {ledger.groupName}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(ledger.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`ml-2 flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                ledger.tallyIntegration 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {ledger.tallyIntegration ? 'Synced' : 'Pending'}
              </span>
            </div>
            {/* ACTION BUTTONS - MOBILE */}
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleEditClick(ledger)}
                disabled={isUpdating || isDeleting}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit ledger"
              >
                <FaEdit className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteLedger(ledger)}
                disabled={isDeleting}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete ledger"
              >
                <LuTrash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

                {/* Desktop Table View */}
                 <div className="hidden lg:block overflow-auto max-h-[60vh]">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ledger Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLedgers.map((ledger: any) => (
              <tr key={ledger._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ledger.ledgerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">{ledger.groupName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(ledger.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    ledger.tallyIntegration 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {ledger.tallyIntegration ? 'Synced' : 'Pending'}
                  </span>
                </td>
                {/* ACTION BUTTONS - DESKTOP */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditClick(ledger)}
                      disabled={isUpdating || isDeleting}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Edit ledger"
                    >
                      <FaEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLedger(ledger)}
                      disabled={isDeleting}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete ledger"
                    >
                      <LuTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-md"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                {editingLedger ? 'Edit Ledger' : 'Add Ledger'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <LuX className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ledger Name *
                </label>
                <input
                  type="text"
                  value={ledgerName}
                  onChange={(e) => setLedgerName(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Enter ledger name"
                  autoFocus
                />
              </div>

              {/* GROUP NAME SELECTOR - FIXED IMPLEMENTATION */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name *
                </label>
                <select
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value as GroupName)}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm sm:text-base bg-white cursor-pointer"
                >
                  {GROUP_OPTIONS.map((option) => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      className="py-1.5"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select accounting group for this ledger
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  onClick={handleCloseModal}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isCreating || isUpdating || !ledgerName.trim() || !groupName}
                  className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg transition-colors text-sm sm:text-base shadow-sm disabled:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {isCreating || isUpdating ? 'Saving...' : editingLedger ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default LedgerPage;