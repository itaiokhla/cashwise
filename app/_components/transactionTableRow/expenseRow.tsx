import React, { useState } from "react";
import { motion } from "framer-motion";
import TransactionDetailsModal from "./TransactionDetailsModal";
import ExpenseDetailsModal from "../dashbaordComps/ExpenseDetails.Modal";

interface ExpenseTransaction {
  amount: number;
  description: string;
  remarks: string;
  tallyEntry: string;
  paymentFiles: string[];
  // Include other possible transaction fields
  [key: string]: any;
}

interface ExpenseItem {
  _id: string;
  date: string;
  porter: ExpenseTransaction[];
  purchase: ExpenseTransaction[];
  food: ExpenseTransaction[];
  conveyance: ExpenseTransaction[];
  cartage: ExpenseTransaction[];
  // Add all other expense categories
  [key: string]: any;
}

interface ExpenseRowProps {
  expenseData: ExpenseItem;
  name: string;
  userName: string;
  userId: string;
}

const EXPENSE_CATEGORIES = [
  "porter",
  "purchase",
  "food",
  "conveyance",
  "cartage",
  "courier",
  "dailyWages",
  "hotel",
  "labour",
  "loading",
  "maintenance",
  "other",
  "rider",
  "tea",
  "transport",
];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "2-digit",
    year: "2-digit",
  });
};

const ExpenseRow: React.FC<ExpenseRowProps> = ({ expenseData, name, userName, userId }) => {

  const [transactionModal, setTransactionModal] = React.useState(false);
  // const [currentExpenseDetails, setCurrentExpenseDetails] = React.useState<{
  //   amount: number;
  //   description: string;
  //   remarks: string;
  //   paymentFiles: string[];
  //   date: string;
  //   category: string;
  // } | null>(null);
  const [transactionData, setTransactionData] = useState<any>()
  const openTransactionModal = (
    transaction: ExpenseTransaction,
    category: string
  ) => {
    // setCurrentExpenseDetails({
    //   ...transaction,
    //   date: expenseData.date,
    //   category,
    // });
    setTransactionData({ data: [transaction], date: expenseData.date, expenseType: category, name: userName, userId })
    setTransactionModal(true);

  };

  const closeTransactionModal = () => {
    setTransactionModal(false);
  };
  return (
    <>
      {EXPENSE_CATEGORIES.map((category) =>
        (expenseData[category] || []).map(
          (transaction: ExpenseTransaction, index: number) => (
            <motion.tr
              key={`${expenseData._id}-${category}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-b border-gray-200 hover:bg-yellow-200 bg-yellow-100 cursor-pointer"
            >
              <td
                className="p-3 whitespace-nowrap"
                onClick={() => openTransactionModal(transaction, category)}
              >
                {name}
                <br />
                <span className="text-xs text-gray-400">Expense</span>
              </td>
              <td
                className="p-3 whitespace-nowrap border-l border-gray-400"
                onClick={() => openTransactionModal(transaction, category)}
              >
                {formatDate(expenseData.date)}
              </td>

              <td
                className="p-3"
                onClick={() => openTransactionModal(transaction, category)}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="font-bold text-red-500"
                >
                  -₹{transaction.amount?.toLocaleString("en-IN")}
                </motion.div>
              </td>
              <td
                className="p-3 capitalize"
                onClick={() => openTransactionModal(transaction, category)}
              >
                {category} Expense
              </td>
              <td
                className="p-3 capitalize"
                onClick={() => openTransactionModal(transaction, category)}
              >
                {transaction.remarks || "N/A"}
              </td>

              <td
                className="p-3 max-w-[200px] truncate"
                title={transaction.description}
                onClick={() => openTransactionModal(transaction, category)}
              >
                {transaction.description}
              </td>
              <td className="p-3 flex flex-wrap gap-2">
                {transaction.paymentFiles?.map((file, fileIndex) => (
                  <motion.a
                    key={fileIndex}
                    href={file}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    className="hover:shadow-md transition-shadow"
                  >
                    <motion.img
                      key={fileIndex}
                      whileHover={{ scale: 1.1 }}
                      src={file}
                      alt="Expense document"
                      className="h-10 w-10 object-cover rounded mr-2"
                      loading="lazy"
                    />
                  </motion.a>
                ))}
              </td>
              <td className="p-3 capitalize">{transaction?.tallyEntry || 'N/A'}</td>

            </motion.tr>
          )
        )
      )}
      {/* <TransactionDetailsModal
          closeModal={closeTransactionModal}
          transactionData={currentExpenseDetails}
          category={currentExpenseDetails?.category || ""}
          name={name}
        /> */}
      {transactionModal && (
        <ExpenseDetailsModal closeModal={closeTransactionModal} transactionData={transactionData} />
      )}
    </>
  );
};

export default ExpenseRow;
