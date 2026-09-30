import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaMoneyBillWave,
  FaTimes,
  FaEye,
  FaArrowLeft,
  FaBuilding,
  FaPlane,
  FaMoneyBill,
} from "react-icons/fa";
import TransactionDetailsModal from "./AdminTransactionDetails";


// Define the userTotalExpense function
const userTotalExpense = (transactions: any[]) => {
  if (!transactions || transactions.length === 0) return 0;
  
  // Handle both direct transactions and nested person structures
  return transactions.reduce((sum, item) => {
    // Check if this is a person object with transactionDetails
    if (item.transactionDetails && Array.isArray(item.transactionDetails)) {
      return sum + item.transactionDetails.reduce(
        (personSum: number, txn: any) => personSum + (txn.money || 0),
        0
      );
    }
    // Otherwise, it's a direct transaction
    return sum + (item.money || 0);
  }, 0);
};

export default function TransactionSummaryDetailsModal({ closeModal, summaryData }: any) {
  const [accountData, setAccountData] = useState<any>(null);
  const [showUsersWithoutExpenses, setShowUsersWithoutExpenses] = useState(false);

  const getExpenseDetailsKey = () => {
    switch (summaryData.type.toLowerCase()) {
      case "credit":
        return "creditDetails";
      case "debit":
        return "debitDetails";
      default:
        return "creditDetails";
    }
  };

  const detailsKey = getExpenseDetailsKey();
  
  // Flatten all transactions
   const flattenTransactions = (users: any[]) => {
    return users.flatMap(user => {
      const items = user[detailsKey] || [];
      
      return items.flatMap((item: any) => {
        // For person objects with transactionDetails
        if (item.transactionDetails && Array.isArray(item.transactionDetails)) {
          return item.transactionDetails.map((txn: any) => ({
            ...txn,
            userName: user.name,
            userPhone: user.phone,
            userRole: user.role,
            userEmail: user.email,
            personName: item.name,
            personPhone: item.phone
          }));
        }
        // For direct transactions (shouldn't happen but just in case)
        return {
          ...item,
          userName: user.name,
          userPhone: user.phone,
          userRole: user.role,
          userEmail: user.email
        };
      });
    });
  };


  const allTransactions = flattenTransactions(summaryData.data);
  
 const usersWithExpenses = summaryData.data.filter(
    (user: any) => {
      const items = user[detailsKey] || [];
      return userTotalExpense(items) > 0;
    }
  );

    const usersWithoutExpenses = summaryData.data.filter(
    (user: any) => {
      const items = user[detailsKey] || [];
      return userTotalExpense(items) === 0;
    }
  );

 const totalExpense = allTransactions.reduce(
    (sum: number, txn: any) => sum + (txn.money || 0),
    0
  )

  const getExpenseIcon = () => {
    switch (summaryData.type) {
      case "Credit":
        return <FaMoneyBillWave className="text-green-500" />;
      case "Debit":
        return <FaMoneyBill className="text-red-500" />;
      default:
        return <FaMoneyBillWave />;
    }
  };

  const getColorClasses = () => {
    switch (summaryData.type) {
      case "Credit":
        return {
          border: "border-green-500",
          text: "text-green-600",
          bg: "bg-green-50",
          gradient: "from-green-600 to-green-400",
        };
      case "Debit":
        return {
          border: "border-red-500",
          text: "text-red-600",
          bg: "bg-red-50",
          gradient: "from-red-600 to-red-400",
        };
      default:
        return {
          border: "border-green-500",
          text: "text-green-600",
          bg: "bg-green-50",
          gradient: "from-green-600 to-green-400",
        };
    }
  };

  const colors = getColorClasses();

  if (!summaryData.data || summaryData.data.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white rounded-lg p-6 text-center">
          <p>No data available</p>
          <button
            onClick={closeModal}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

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
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${colors.bg}`}>
                  {getExpenseIcon()}
                </div>
                <div>
                  <h2
                    className="text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${colors.gradient})`,
                    }}
                  >
                    {`${summaryData.type} Transaction Overview`}
                  </h2>

                  <div className="mt-2">
                    <h3 className="text-2xl font-bold text-gray-800">
                      Total {summaryData.type} Amount
                    </h3>
                    <p className={`text-3xl font-bold mt-1 ${colors.text}`}>
                      ₹{totalExpense.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {usersWithExpenses.length} user(s) with {summaryData.type.toLowerCase()} transactions
                  </div>
                </div>
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

          <div className="space-y-6">
            <div className="grid gap-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">
                Users with {summaryData.type} Transactions
              </h4>
              {usersWithExpenses.map((user: any, index: number) => {
                const transactions = user[detailsKey]?.flatMap(
                  (person: any) => person.transactionDetails
                ) || [];
                
                const userExpense = userTotalExpense(transactions);
                
                return (
                  <motion.div
                    key={user._id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full shadow-md bg-gray-100 flex items-center justify-center text-black font-bold"
                          style={{
                            backgroundImage: `linear-gradient(to bottom right, ${colors.gradient})`,
                          }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-800">
                            {user.name}
                          </h5>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <FaPhone className="text-green-500" />
                              {user.phone}
                            </span>
                            {user.email && (
                              <span className="flex items-center gap-1">
                                <FaEnvelope className="text-purple-500" />
                                {user.email}
                              </span>
                            )}
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                              {user.role.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`text-xl font-bold ${colors.text}`}>
                            ₹{userExpense.toLocaleString("en-IN")}
                          </div>
                          <div className="text-sm text-gray-500">
                            {transactions.length} transaction(s)
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if(summaryData.type === "Credit") {
                            setAccountData({
                            transaction: user.creditDetails,
                            transactionType: "credit",
                          });
                        }
                            else if(summaryData.type === "Debit") {
                              setAccountData({
                                transaction: user.debitDetails,
                                transactionType: "debit",
                              });
                            }
                          }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <FaEye /> Details
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {usersWithoutExpenses.length > 0 && (
              <div className="grid gap-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  Users without {summaryData.type} Transactions
                  <button
                    className="p-2 bg-gray-300 shadow-md rounded-xl text-sm "
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUsersWithoutExpenses(!showUsersWithoutExpenses);
                    }}
                  >
                    {showUsersWithoutExpenses ? "Hide" : "Show"}
                  </button>
                </h4>

                {showUsersWithoutExpenses &&
                  usersWithoutExpenses.map((user: any, index: number) => (
                    <motion.div
                      key={user._id}
                      whileHover={{ scale: 1.02 }}
                      className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full shadow-md bg-gray-100 flex items-center justify-center text-black font-bold"
                            style={{
                              backgroundImage: `linear-gradient(to bottom right, ${colors.gradient})`,
                            }}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-800">
                              {user.name}
                            </h5>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <FaPhone className="text-green-500" />
                                {user.phone}
                              </span>
                              {user.email && (
                                <span className="flex items-center gap-1">
                                  <FaEnvelope className="text-purple-500" />
                                  {user.email}
                                </span>
                              )}
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                                {user.role.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${colors.text}`}>
                            ₹0
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
      {accountData && (
        <TransactionDetailsModal
          closeModal={() => setAccountData(null)}
          accountData={accountData}
        />
      )}
    </div>
  );
}