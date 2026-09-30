import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaCalendarAlt,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaMoneyBillWave,
  FaTimes,
  FaArrowLeft,
} from "react-icons/fa";

type Transaction = {
  money: number;
  reason: string;
  remarks: string;
  imageUrl: string[];
  createdAt: string;
  updatedAt: string;
  _id: string;
};

type Person = {
  name: string;
  email: string;
  phone: string;
  transactionDetails: Transaction[];
  _id: string;
  createdAt: string;
  updatedAt: string;
};

type AccountData =
  | {
      creditDetails?: Person[];
    }
  | Person[];

type CreditDetailsModalProps = {
  closeModal: () => void;
  accountData: any;
};

export default function TransactionDetailsModal({
  closeModal,
  accountData,
}: CreditDetailsModalProps) {
  const [selectedPerson, setSelectedPerson] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    { transaction: Transaction; personInfo: Person }[]
  >([]);
  const [transactionsByReason, setTransactionsByReason] = useState<
    Record<string, { transaction: Transaction; personInfo: Person }[]>
  >({});

  // Normalize account data structure
  useEffect(() => {
    if (Array.isArray(accountData?.transaction)) {
      setAllPersons(accountData?.transaction);
    } else if (
      accountData?.transaction &&
      Array.isArray(accountData?.transaction?.creditDetails)
    ) {
      setAllPersons(accountData?.transaction?.creditDetails);
    } else {
      setAllPersons([]);
    }
  }, [accountData?.transaction]);

  // Filter transactions
  useEffect(() => {
    let transactions: { transaction: Transaction; personInfo: Person }[] = [];

    // Flatten all transactions with person info
    allPersons.forEach((person) => {
      person.transactionDetails.forEach((transaction) => {
        transactions.push({ transaction, personInfo: person });
      });
    });

    // Apply person filter
    if (selectedPerson) {
      transactions = transactions.filter(
        (item) => item.personInfo._id === selectedPerson
      );
    }

    // Apply reason filter
    if (selectedReason) {
      transactions = transactions.filter(
        (item) => item.transaction.reason === selectedReason
      );
    }

    // Sort by date (newest first)
    transactions.sort(
      (a, b) =>
        new Date(b.transaction.createdAt).getTime() -
        new Date(a.transaction.createdAt).getTime()
    );

    setFilteredTransactions(transactions);
  }, [allPersons, selectedPerson, selectedReason]);

  // Group transactions by reason
  useEffect(() => {
    const grouped: Record<
      string,
      { transaction: Transaction; personInfo: Person }[]
    > = {};

    filteredTransactions.forEach((item) => {
      const reason = item.transaction.reason;
      if (!grouped[reason]) {
        grouped[reason] = [];
      }
      grouped[reason].push(item);
    });

    setTransactionsByReason(grouped);
  }, [filteredTransactions]);

  // Calculate totals
  const calculateTotalAmount = (
    transactions: { transaction: Transaction; personInfo: Person }[]
  ) => {
    return transactions.reduce(
      (total, item) => total + item.transaction.money,
      0
    );
  };

  const totalAmount = calculateTotalAmount(filteredTransactions);
  const totalTransactions = filteredTransactions.length;

  // Get unique reasons
  const getUniqueReasons = () => {
    const reasons = new Set<string>();
    allPersons.forEach((person) => {
      person.transactionDetails.forEach((transaction) => {
        reasons.add(transaction.reason);
      });
    });
    return Array.from(reasons).sort();
  };

  const uniqueReasons = getUniqueReasons();

  // Date format functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={(e) => {
        e.stopPropagation();
        closeModal();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeModal();
            }}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2"
          >
            <FaArrowLeft size={20} /> Go Back
          </button>
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <div>
              <h2
                className={`text-xl font-bold bg-gradient-to-r from-${
                  accountData?.transactionType === "credit" ? "green" : "purple"
                }-600 to-purple-600 bg-clip-text text-transparent`}
              >
                <span className="capitalize">
                  {" "}
                  {accountData?.transactionType}
                </span>{" "}
                Transaction Details
              </h2>
              <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <FaCalendarAlt
                    className={`${
                      accountData?.transactionType === "credit"
                        ? "text-green-500"
                        : "text-purple-500"
                    }`}
                  />
                  Total Transactions: {totalTransactions}
                </span>
                <span className="flex items-center gap-1">
                  <FaMoneyBillWave
                    className={`text-${
                      accountData?.transactionType === "credit"
                        ? "green"
                        : "purple"
                    }-500`}
                  />
                  Total Amount: ₹{totalAmount.toLocaleString("en-IN")}
                </span>
                <span className="flex items-center gap-1">
                  <FaUser className="text-purple-500" />
                  Total Persons: {allPersons.length}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
              className="text-gray-500 hover:text-gray-700 text-3xl font-light"
            >
              <FaTimes />
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Person Filter */}
            <div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="font-medium text-gray-700">
                  Filter by Person:
                </span>
                <button
                  onClick={() => setSelectedPerson("")}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedPerson === ""
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  All Persons ({allPersons.length})
                </button>
                {allPersons.map((person) => {
                  const personTransactionCount =
                    person.transactionDetails.length;
                  const personTotal = person.transactionDetails.reduce(
                    (total, transaction) => total + transaction.money,
                    0
                  );
                  return (
                    <button
                      key={person._id}
                      onClick={() => setSelectedPerson(person._id)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedPerson === person._id
                          ? "bg-purple-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                      title={`₹${personTotal.toLocaleString("en-IN")} total`}
                    >
                      {person.name} ({personTransactionCount})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reason Filter */}
            <div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="font-medium text-gray-700">
                  Filter by Reason:
                </span>
                <button
                  onClick={() => setSelectedReason("")}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedReason === ""
                      ? `bg-${
                          accountData?.transactionType === "credit"
                            ? "green"
                            : "purple"
                        }-500 text-white`
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  All Reasons
                </button>
                {uniqueReasons.map((reason) => {
                  const reasonTransactions = filteredTransactions.filter(
                    (item) => item.transaction.reason === reason
                  );
                  const reasonCount = reasonTransactions.length;
                  const reasonTotal = calculateTotalAmount(reasonTransactions);
                  return (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedReason === reason
                          ? `bg-${
                              accountData?.transactionType === "credit"
                                ? "green"
                                : "purple"
                            }-500 text-white`
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                      title={`₹${reasonTotal.toLocaleString("en-IN")} total`}
                    >
                      {reason.toUpperCase()} ({reasonCount})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {Object.keys(transactionsByReason).length > 0 ? (
              Object.entries(transactionsByReason).map(
                ([reason, transactions]) => (
                  <motion.div
                    key={reason}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 w-full"
                  >
                    {/* Reason Header */}
                    <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm w-full">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full ${
                            reason === "office"
                              ? "bg-purple-500"
                              : reason === "TOF"
                              ? `bg-${
                                  accountData?.transactionType === "credit"
                                    ? "green"
                                    : "purple"
                                }-500`
                              : "bg-purple-500"
                          }`}
                        ></div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">
                            {reason.toUpperCase()} Transactions
                          </h3>
                          <p className="text-sm text-gray-600">
                            {transactions.length} transaction
                            {transactions.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Category Total</p>
                        <p
                          className={`text-lg font-semibold text-${
                            accountData?.transactionType === "credit"
                              ? "green"
                              : "purple"
                          }-600`}
                        >
                          ₹
                          {calculateTotalAmount(transactions).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Transactions */}
                    <div className="grid gap-4  w-full">
                      {transactions.map((item, index) => (
                        <motion.div
                          key={item.transaction._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex flex-col gap-2 justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg`}
                              >
                                {item.personInfo.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800 text-lg">
                                  {item.personInfo.name}
                                </h4>
                                <div className="flex flex-col md:flex-row items-start md:items-center  gap-2 text-sm text-gray-600">
                                  {item.personInfo.email && (
                                    <span className="flex items-center gap-1">
                                      <FaEnvelope className="text-purple-500" />
                                      {item.personInfo.email}
                                    </span>
                                  )}
                                  <a
                                    href={`tel:${item.personInfo.phone}`}
                                    className="flex items-center gap-1 text-purple-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FaPhone
                                      className={`text-${
                                        accountData?.transactionType ===
                                        "credit"
                                          ? "green"
                                          : "purple"
                                      }-500`}
                                    />
                                    {item.personInfo.phone}
                                  </a>
                                </div>
                              </div>
                            </div>
                            <div className="text-left md:text-right">
                              <div
                                className={`text-2xl font-bold text-${
                                  accountData?.transactionType === "credit"
                                    ? "green"
                                    : "purple"
                                }-600`}
                              >
                                ₹
                                {item.transaction.money.toLocaleString("en-IN")}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(item.transaction.createdAt)} •{" "}
                                {formatTime(item.transaction.createdAt)}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <div className="mb-2">
                                <span className="font-medium text-gray-700">
                                  Reason:
                                </span>
                                <span
                                  className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                    item.transaction.reason === "office"
                                      ? "bg-purple-100 text-purple-800"
                                      : item.transaction.reason === "TOF"
                                      ? `bg-green-100 text-${
                                          accountData?.transactionType ===
                                          "credit"
                                            ? "green"
                                            : "purple"
                                        }-800`
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {item.transaction.reason.toUpperCase()}
                                </span>
                              </div>
                              {item.transaction.remarks && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Remarks:
                                  </span>
                                  <p className="text-gray-900 mt-1 text-sm bg-gray-50 p-2 rounded">
                                    {item.transaction.remarks}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2 text-sm">
                              {/* <div>
                              <span className="font-medium text-gray-700">Transaction ID:</span>
                              <span className="ml-2 text-gray-600 font-mono text-xs">
                                {item.transaction._id}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Created:</span>
                              <span className="ml-2 text-gray-600">
                                {formatDate(item.transaction.createdAt)} at {formatTime(item.transaction.createdAt)}
                              </span>
                            </div> */}
                              {item.transaction.updatedAt !==
                                item.transaction.createdAt && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Updated:
                                  </span>
                                  <span className="ml-2 text-gray-600">
                                    {formatDate(item.transaction.updatedAt)} at{" "}
                                    {formatTime(item.transaction.updatedAt)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Images */}
                          {item.transaction.imageUrl &&
                            item.transaction.imageUrl.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <p className="font-medium text-gray-700 mb-2">
                                  📎 Attached Images:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {item.transaction.imageUrl.map((url, i) => (
                                    <a
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <motion.img
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        src={url}
                                        alt={`Transaction image ${i + 1}`}
                                        className={`w-20 h-20 object-cover rounded-md border-2 border-${
                                          accountData?.transactionType ===
                                          "credit"
                                            ? "green"
                                            : "purple"
                                        }-300 hover:border-${
                                          accountData?.transactionType ===
                                          "credit"
                                            ? "green"
                                            : "purple"
                                        }-500 cursor-pointer`}
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-6xl mb-4">💳</div>
                <p className="text-lg">
                  No {accountData?.transactionType} transactions found
                </p>
                {(selectedPerson || selectedReason) && (
                  <p className="text-sm mt-2">
                    Try adjusting your filters to see more results
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Summary Footer */}
          {filteredTransactions.length > 0 && (
            <div
              className={`mt-6 pt-4 border-t bg-gradient-to-r from-${
                accountData?.transactionType === "credit" ? "green" : "purple"
              }-50 to-purple-50 p-4 rounded-lg`}
            >
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {filteredTransactions.length} transaction
                  {filteredTransactions.length > 1 ? "s" : ""}
                  {selectedPerson &&
                    ` for ${
                      allPersons.find((p) => p._id === selectedPerson)?.name
                    }`}
                  {selectedReason && ` in ${selectedReason.toUpperCase()}`}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total Amount</div>
                  <div
                    className={`text-xl font-bold text-${
                      accountData?.transactionType === "credit"
                        ? "green"
                        : "purple"
                    }-600`}
                  >
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
