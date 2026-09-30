import React from 'react';
import { motion } from 'framer-motion';

type CloseTransactionModalProps = {
  closeModal: () => void;
  transactionData: any;
  category: string;
  name: string;
};

const TransactionDetailsModal: React.FC<CloseTransactionModalProps> = ({ 
  closeModal, 
  transactionData,
  category,
  name,
}) => {
  // Common fields we're already displaying explicitly
  const excludedFields = [
    'amount', 
    'description', 
    'remarks', 
    'paymentFiles',
    'date',
    'createdBy',
    '_id',
    '__v'
  ];

  // Format field names for display
  const formatFieldName = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase());
  };

  // Helper to display values appropriately
  const displayValue = (key: string, value: any) => {
    // Check for null, undefined, or empty values
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)) {
      return null; // Return nothing for null, undefined, or empty values
    }
  
    // Handle phone numbers
    if (key.toLowerCase().includes('number') && typeof value === 'number') {
      value = value.toString().replace(/[^0-9]/g, '');
      return (
        <a 
          href={`tel:${value}`} 
          className="text-purple-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value.toLocaleString('en-IN')}
        </a>
      );
    }
  
    // Handle location coordinates
    if (key === 'location' && typeof value === 'string' && value.startsWith('{')) {
      try {
        const loc = JSON.parse(value);
        return (
          <a
            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline"
          >
            View on Google Maps
          </a>
        );
      } catch {
        return 'Invalid location format';
      }
    }
  
    // Handle generic values
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
      return Number.isInteger(value) 
        ? value.toLocaleString('en-IN')
        : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
  
    return value; // Return the value or 'N/A' if it's falsy
  };

  // Get dynamic fields that aren't excluded
  const dynamicFields = Object.entries(transactionData)
    .filter(([key]) => !excludedFields.includes(key))
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== [].length > 0);

  // Parse location if present
  const location = transactionData.location?.startsWith('{') 
    ? JSON.parse(transactionData.location)
    : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-300 rounded-lg shadow-xl w-full max-w-md mx-4"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent">
              Transaction Details
            </h2>
            <button
              onClick={closeModal}
              className="text-gray-500 hover:text-gray-700 transition-colors text-3xl"
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 text-gray-700 max-h-[80vh] overflow-y-auto">
            {/* Static Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold">Name:</p>
                <p className="mt-1">{name}</p>
              </div>
              <div>
                <p className="font-semibold">Date:</p>
                <p className="mt-1">
                  {new Date(transactionData.date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="font-semibold">Category:</p>
                <p className="mt-1 capitalize">{category}</p>
              </div>
              <div>
                <p className="font-semibold">Amount:</p>
                <p className="mt-1 text-purple-500 font-bold">
                  ₹{transactionData.amount?.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="font-semibold">Status:</p>
                <p className={`mt-1 capitalize ${transactionData?.status==='pending'?'text-yellow-600':transactionData?.status==='reject'?'text-red-500':'text-green-500'}`}>{transactionData?.status}</p>
              </div>
            </div>
            <div>
                <p className="font-semibold">Admin Remarks:</p>
                <p className="mt-1 capitalize text-cyan-500">{transactionData?.adminMessage}</p>
              </div>
             
            {/* Location Display */}
            {/* {location && (
              <div>
                <p className="font-semibold">Location:</p>
                <div className="mt-1 space-y-1">
                  <a
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline"
                  >
                    View on Google Maps
                  </a>
                </div>
              </div>
            )} */}

            {/* Dynamic Fields */}
            {dynamicFields.length > 0 && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-lg mb-3">Additional Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dynamicFields.map(([key, value]) => (
                      <div key={key}>
                        <p className="font-semibold">{formatFieldName(key)}:</p>
                        <div className="mt-1 whitespace-pre-wrap break-words">
                          {displayValue(key, value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Files */}
            {transactionData.paymentFiles?.length > 0 && (
              <div>
                <p className="font-semibold mb-2">Payment Documents:</p>
                <div className="grid grid-cols-3 gap-4">
                  {transactionData.paymentFiles.map((file: string, index: number) => (
                    <a
                      key={index}
                      href={file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block"
                    >
                      <motion.img
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        src={file}
                        alt={`Payment document ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-transparent transition-colors"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TransactionDetailsModal;