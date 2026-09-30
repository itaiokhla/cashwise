import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaCalendarAlt,
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
import AdminAccountDetailsModal from "./AdminAccountDetailsModal";
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

type UserData = {
  _id: string;
  name: string;
  phone: number;
  role: string;
  email: string;
  creditDetails: Person[];
  debitDetails: Person[];
  balance: number;
  officeExpenseDetails: any[];
  travelExpenseDetails: any[];
  toPayExpenseDetails: any[];
};

type SummaryDetailsModalProps = {
  closeModal: () => void;
  summaryData: {
    data: UserData[];
    type: "Office" | "Travel" | "ToPay";
  };
};

export default function SummaryDetailsModal({ closeModal, summaryData }: any) {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentData, setCurrentData] = useState<any>(null);
  const [showUsersWithoutExpenses, setShowUsersWithoutExpenses] =
    useState(false);
  const getExpenseDetailsKey = (type: any) => {
    switch (type) {
      case "Office":
        return "officeExpenseDetails";
      case "Travel":
        return "travelExpenseDetails";
      case "ToPay":
        return "toPayExpenseDetails";
      default:
        return "officeExpenseDetails";
    }
  };

  const detailsKey = getExpenseDetailsKey(summaryData.type);

  const userTotalExpense = (expenseDetails: any) => {
    let totalAmount = 0;
    if (!expenseDetails) return 0;
    expenseDetails.forEach((expense: any) => {
      const categories = [
        "conveyance",
        "cartage",
        "courier",
        "dailyWages",
        "food",
        "hotel",
        "labour",
        "loading",
        "maintenance",
        "other",
        "porter",
        "purchase",
        "rider",
        "tea",
        "transport",
      ];
      categories.forEach((category) => {
        if (expense[category]) {
          expense[category].forEach((item: any) => {
            totalAmount += item.amount || 0;
          });
        }
      });
    });
    return totalAmount;
  };

  const usersWithExpenses = summaryData.data.filter(
    (user: any) => userTotalExpense(user[detailsKey]) > 0
  );
  const usersWithoutExpenses = summaryData.data.filter(
    (user: any) => userTotalExpense(user[detailsKey]) === 0
  );
  const totalExpense = usersWithExpenses.reduce(
    (sum: any, user: any) => sum + userTotalExpense(user[detailsKey]),
    0
  );

  const getExpenseIcon = () => {
    switch (summaryData.type) {
      case "Office":
        return <FaBuilding className="text-orange-500" />;
      case "Travel":
        return <FaPlane className="text-purple-500" />;
      case "ToPay":
        return <FaMoneyBill className="text-yellow-500" />;
      default:
        return <FaBuilding />;
    }
  };

  const getColorClasses = () => {
    switch (summaryData.type) {
      case "Office":
        return {
          border: "border-orange-500",
          text: "text-orange-600",
          bg: "bg-orange-50",
          gradient: "from-orange-600 to-orange-400",
        };
      case "Travel":
        return {
          border: "border-purple-500",
          text: "text-purple-600",
          bg: "bg-purple-50",
          gradient: "from-purple-600 to-purple-400",
        };
      case "ToPay":
        return {
          border: "border-yellow-500",
          text: "text-yellow-600",
          bg: "bg-yellow-50",
          gradient: "from-yellow-600 to-yellow-400",
        };
      default:
        return {
          border: "border-orange-500",
          text: "text-orange-600",
          bg: "bg-orange-50",
          gradient: "from-orange-600 to-orange-400",
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
                    {selectedUser
                      ? `${selectedUser.name} - Summary`
                      : `${summaryData.type} Expense Overview`}
                  </h2>

                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">
                      Total {summaryData.type} Expenses
                    </h3>
                    <p className={`text-3xl font-bold mt-1 ${colors.text}`}>
                      ₹{totalExpense.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    {usersWithExpenses.length}/{summaryData?.data?.length} users
                    with {summaryData.type} expenses
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
                Users with {summaryData.type} Expenses
              </h4>
              {usersWithExpenses.map((user: any, index: number) => {
                const expense = userTotalExpense(user[detailsKey]);
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
                            ₹{expense.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentData({
                              expenseDetails: user[detailsKey],
                              expenseType: summaryData.type,
                            });
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

            <div className="grid gap-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                Users without {summaryData.type} Expenses
                <button
                  className="p-2 bg-gray-300 shadow-md rounded-xl text-sm "
                  onClick={(e) => {
                    e.stopPropagation(),
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
          </div>
        </div>
      </motion.div>
      {currentData && (
        <AdminAccountDetailsModal
          closeModal={() => setCurrentData(null)}
          accountData={currentData}
        />
      )}
    </div>
  );
}
