"use client";
import client from "@createRequest";
import React, { useEffect } from "react";
import Loader from "@app/_components/Loader";
import Sidebar from "@app/_components/Sidebar";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import UserDashboardFilterModal from "@app/_components/filter/UserDashbaordFilter";
import { set } from "mongoose";
import ExpenseDetailsModal from "@app/_components/dashbaordComps/ExpenseDetails.Modal";
import { FaArrowLeft } from "react-icons/fa";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";

const tableHeaders = [
  "Date",
  "Expense Type",
  "Conveyance",
  "Purchase",
  "Food",
  "Tea",
  "Hotel",
  "Labour",
  "Courier",
  "Loading",
  "Porter",
  "Cartage",
  "Rider",
  "Daily Wages",
  "Transport",
  "Maintenance",
  "Contractor",
  "Other",
];
const calculateTotal = (items: any[]) => {
  return items?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
};

const getDefaultDates = () => {
  const today = new Date();
  const defaultFrom = new Date();
  // defaultFrom.setDate(today.getDate() - 1);
  return {
    from: defaultFrom.toISOString().split("T")[0],
    to: today.toISOString().split("T")[0],
  };
};

const calculateMoney = (item: any) => {
  let totalOfficeCreditMoney = 0;
  let totalOfficeDebitMoney = 0;
  let totalTravelCreditMoney = 0;
  let totalTravelDebitMoney = 0;
  let totalToPayDebitMoney = 0;
  let totalToPayCreditMoney = 0;
  let totalOtherDebitMoney = 0;
  let totalOtherCreditMoney = 0;

  (item.credit || []).forEach((creditItem: any) => {
    creditItem.transactionDetails.forEach((transaction: any) => {
      if (transaction.reason === "office") {
        totalOfficeCreditMoney += transaction.money || 0;
      } else if (transaction.reason === "travel") {
        totalTravelCreditMoney += transaction.money || 0;
      } else if (transaction.reason === "toPay") {
        totalToPayCreditMoney += transaction.money || 0;
      } else {
        totalOtherCreditMoney += transaction.money || 0;
      }
    });
  });

  (item.debit || []).forEach((debitItem: any) => {
    debitItem.transactionDetails.forEach((transaction: any) => {
      if (transaction.reason === "office") {
        totalOfficeDebitMoney += transaction.money || 0;
      } else if (transaction.reason === "travel") {
        totalTravelDebitMoney += transaction.money || 0;
      } else if (transaction.reason === "toPay") {
        totalToPayDebitMoney += transaction.money || 0;
      } else {
        totalOtherDebitMoney += transaction.money || 0;
      }
    });
  });

  const balance = Math.round(
    totalOfficeCreditMoney -
      totalOfficeDebitMoney +
      (totalTravelCreditMoney - totalTravelDebitMoney) +
      (totalToPayCreditMoney - totalToPayDebitMoney) +
      (totalOtherCreditMoney - totalOtherDebitMoney)
  );

  return { balance };
};

export default function Page() {
  const user = useAppSelector(selectUser);
  const pathname = usePathname();
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expenseType, setExpenseType] = React.useState("all");
  const [fromDateState, setFromDate] = React.useState<string>(
    getDefaultDates().from
  );
  const [toDateState, setToDate] = React.useState<string>(getDefaultDates().to);
  const [userData, setUserData] = React.useState<any>(null);
  const [currentExpenseData, setCurrentExpenseData] = React.useState<any>(null);
  const [expenseModal, setExpenseModal] = React.useState(false);
  const [totalExpense, setTotalExpense] = React.useState(0);

  const router = useRouter();

  const userId = pathname.split("/")[3];

  useEffect(() => {
    const fetchData = async () => {
      if (!fromDateState || !toDateState) return;
      setLoading(true);
      try {
        const response = await client.get(`/users/expenses/${userId}`, {
          params: { fromDate: fromDateState, toDate: toDateState, expenseType },
        });

        if (response.status === 200) {
          const data = response.data.data;
          const combined = [
            ...(data.officeData?.map((e: any) => ({ ...e, type: "Office" })) ||
              []),
            ...(data.travelData?.map((e: any) => ({ ...e, type: "Travel" })) ||
              []),
            ...(data.toPayData?.map((e: any) => ({ ...e, type: "To Pay" })) ||
              []),
          ];
          setExpenses(combined);
          // Calculate total expense here
          let newTotalExpense = 0;
          combined.forEach((expense: any) => {
            [
              "conveyance",
              "purchase",
              "food",
              "tea",
              "hotel",
              "labour",
              "courier",
              "loading",
              "porter",
              "cartage",
              "rider",
              "dailyWages",
              "transport",
              "maintenance",
              "contractor",
              "other",
            ].forEach((type) => {
              newTotalExpense += calculateTotal(expense[type]);
            });
          });
          setTotalExpense(newTotalExpense);
          if (data.officeData.length > 0) {
            setUserData(data.officeData[0].user);
          } else if (data.travelData.length > 0) {
            setUserData(data.travelData[0].user);
          } else if (data.toPayData.length > 0) {
            setUserData(data.toPayData[0].user);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    const adminFilterLocal = localStorage.getItem("adminFilter") || null;

    let adminFilter: any;
    if (adminFilterLocal) {
      adminFilter = JSON.parse(adminFilterLocal || "{}");
      setFromDate(adminFilter.fromDate);
      setToDate(adminFilter.toDate);
      setExpenseType(adminFilter.expenseType);
      fetchData();
    } else {
      fetchData();
    }
  }, [fromDateState, toDateState, expenseType, userId]);

  //   date formate
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN");
  };
  const onApplyTransactionDetailsFilters = async (filters: any) => {
    setFromDate(filters.fromDate?.toISOString().split("T")[0] || "");
    setToDate(filters.toDate?.toISOString().split("T")[0] || "");
    setExpenseType(filters.expenseType);
  };

  const handleCurrentExpenseData = ({
    documentId,
    date,
    type,
    data,
    expenseType,
  }: any) => {
    setCurrentExpenseData({
      documentId,
      date,
      formType: type,
      expenseType,
      userId: userData._id,
      name: userData.name,
      phone: userData?.phone,
      data,
    });
    setExpenseModal(true);
  };
  const closeExpenseModal = () => {
    setExpenseModal(false);
    setCurrentExpenseData(null);
  };
  return (
    <section className="flex flex-col bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row flex-grow">
        <Sidebar />
        <div className="flex-1 p-4 overflow-hidden">
          {loading && <Loader />}
          {(user?.role === "admin" || user?.role === "manager") && (
            <button
              onClick={(e) => {
                router.push("/admin/dashboard");
                localStorage.removeItem("adminFilter");
              }}
              className="flex items-center gap-2 text-purple-600 whitespace-nowrap mt-16 md:mt-0"
            >
              <FaArrowLeft />
              Go Back
            </button>
          )}
          <div className="flex justify-between items-center mt-2 ">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-2">
                Expense{" "}
                <span className="text-md text-gray-400 capitalize">
                  {userData?.name}
                </span>
              </h1>
              <p className="text-gray-600 mb-6 hidden md:block">
                Track and manage all expenses
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs md:text-lg ">
              <span className="font-semibold">
                Expenses: ₹{Math.round(totalExpense)}
              </span>
              <span className="font-semibold">
                Balance: ₹
                {userData
                  ? Math.round(
                      calculateMoney(userData).balance
                    ).toLocaleString()
                  : "0"}
              </span>
            </div>
          </div>
          <div className="flex justify-between my-2 ">
            <div>
              <h2 className="text-sm ">Date Filter Applied</h2>
              <p className="text-sm p-2 bg-purple-500 rounded-full shadow-md text-white">
                {(() => {
                  const from = new Date(fromDateState);
                  const to = new Date(toDateState);
                  const diffTime = Math.abs(to.getTime() - from.getTime());
                  const diffDays =
                    Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                  if (
                    diffDays === 1 &&
                    new Date().getDate() === from.getDate() &&
                    new Date().getDate() === to.getDate()
                  ) {
                    return "Today";
                  } else if (diffDays === 1) {
                    return "Yesterday";
                  } else if (diffDays === 8) {
                    return "Week";
                  } else if (diffDays === 31) {
                    return "Month";
                  } else {
                    return `${diffDays - 1} day${diffDays > 1 ? "s" : ""}`;
                  }
                })()}
              </p>
            </div>
            <UserDashboardFilterModal
              onApplyTransactionDetailsFilters={
                onApplyTransactionDetailsFilters
              }
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-lg shadow-sm border border-gray-200 overflow-x-auto max-h-[80vh] overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {tableHeaders.map((header, index) => (
                      <th
                        key={index}
                        className="px-4 bg-gray-300/70 border-b border-b-gray-600 sticky py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-400">
                  {expenses.map((expense, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {expense.type}
                      </td>
                      {[
                        "conveyance",
                        "purchase",
                        "food",
                        "tea",
                        "hotel",
                        "labour",
                        "courier",
                        "loading",
                        "porter",
                        "cartage",
                        "rider",
                        "dailyWages",
                        "transport",
                        "maintenance",
                        "contractor",
                        "other",
                      ].map((expenseType: string, index: number) => {
                        const total = calculateTotal(expense[expenseType]);
                        return (
                          <td
                            key={index}
                            className="px-4 py-3 text-sm text-gray-700"
                            onClick={() =>
                              handleCurrentExpenseData({
                                documentId: expense?._id,
                                date: expense.date,
                                type: expense.type,
                                data: expense[expenseType],
                                expenseType: expenseType,
                              })
                            }
                          >
                            {total > 0 ? (
                              <span className="text-purple-500">
                                {" "}
                                ₹{total.toLocaleString()}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {expenses.length === 0 && !loading && (
                <div className="text-center py-6 text-gray-500">
                  No expenses found !
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
      {expenseModal && (
        <ExpenseDetailsModal
          closeModal={closeExpenseModal}
          transactionData={currentExpenseData}
        />
      )}
    </section>
  );
}
