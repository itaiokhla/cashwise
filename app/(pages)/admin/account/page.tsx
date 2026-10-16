"use client";
import Loader from "@app/_components/Loader";
import Sidebar from "@app/_components/Sidebar";
import React, { useState, useEffect } from "react";
import { Button, DatePicker } from "antd";
import type { SelectProps } from "antd";
import Select from "antd/es/select";
import type { RangePickerProps } from "antd/es/date-picker";
import dayjs from "dayjs";
import { useGetUsersAccountAndExpenseDataQuery } from "@app/_api_query/group.api";
import AdminDashboardFilterModal from "@app/_components/filter/AdminDashboardFilter";
import AccountDashboardFilterModal from "@app/_components/filter/AccountDashboardFilter";
import { toast } from "react-toastify";
import { MdOutlineRefresh } from "react-icons/md";
import { FaArrowAltCircleDown } from "react-icons/fa";
import { motion } from "framer-motion";
import AdminAccountDetailsModal from "@app/_components/dashbaordComps/AdminAccountDetailsModal";
import { LuView } from "react-icons/lu";
import { setUser } from "@redux/users/userSlice";
import CreditModal from "@app/_components/AccountComp/CreditModal";
import TransactionDetailsModal from "@app/_components/dashbaordComps/AdminTransactionDetails";
import { stat } from "fs";
import SummaryDetailsModal from "@app/_components/dashbaordComps/SummaryDetails";
import TransactionSummaryDetailsModal from "@app/_components/dashbaordComps/TransactionSummaryDetails";
import DayBalanceCard from "@app/_components/dashbaordComps/DayBalanceCard";

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AdminAccount() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedFormTpe, setSelectedFormType] = useState<string[]>([]);
  const [expenseType, setExpenseType] = useState("all");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());
  const [singleDate, setSingleDate] = useState(new Date());
  const [currentData, setCurrentData] = useState<any>(null);
  const [accountData, setAccountData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [transactionSummaryData, setTransactionSummaryData] =
    useState<any>(null);
  const queryParams = {
    fromDate: dayjs(fromDate).format("YYYY-MM-DD"),
    toDate: dayjs(toDate).format("YYYY-MM-DD"),
    expenseType,
    user: selectedUsers,
    formType: selectedFormTpe,
    status: status ? status.toLowerCase() : "",
  };
  const {
    data: resultData,
    isLoading,
    error,
    refetch,
  } = useGetUsersAccountAndExpenseDataQuery(queryParams);
  const calculateCreditDebit = (credit: any) => {
    if (!Array.isArray(credit) || credit.length === 0) return 0;
    return credit.reduce((sum, item) => {
      if (item && Array.isArray(item.transactionDetails)) {
        return (
          sum +
          item.transactionDetails.reduce(
            (innerSum: number, transaction: any) =>
              innerSum + (transaction?.money || 0),
            0
          )
        );
      }
      return sum;
    }, 0);
  };

  const calculateExpenses = (expenseDetails: any) => {
    if (!Array.isArray(expenseDetails) || expenseDetails.length === 0) return 0;

    return expenseDetails.reduce((sum, expense) => {
      if (!expense) return sum;

      return (
        sum +
        Object.keys(expense).reduce((catSum, key) => {
          if (Array.isArray(expense[key])) {
            return (
              catSum +
              expense[key].reduce(
                (itemSum: number, item: any) => itemSum + (item?.amount || 0),
                0
              )
            );
          }
          return catSum;
        }, 0)
      );
    }, 0);
  };

  // Calculate overview metrics
  const calculateOverview = () => {
    let totalCredit = 0;
    let totalDebit = 0;
    let totalOfficeExpense = 0;
    let totalTravelExpense = 0;
    let totalToPayExpense = 0;

    resultData?.result.forEach((user: any) => {
      totalCredit += calculateCreditDebit(user?.creditDetails);
      totalDebit += calculateCreditDebit(user?.debitDetails);
      totalOfficeExpense += calculateExpenses(user.officeExpenseDetails);
      totalTravelExpense += calculateExpenses(user.travelExpenseDetails);
      totalToPayExpense += calculateExpenses(user.toPayExpenseDetails);
    });

    return {
      totalUsers: resultData?.result.length || 0,
      totalCredit,
      totalDebit,
      totalOfficeExpense,
      totalTravelExpense,
      totalToPayExpense,
      netBalance:
        totalCredit -
        totalDebit -
        totalOfficeExpense -
        totalTravelExpense -
        totalToPayExpense,
    };
  };

  const overview = calculateOverview();

  useEffect(() => {
    if (error) {
      console.log(error);
      toast.error((error as any).message || "An error occurred");
    }
  }, [error]);

  const onApplyTransactionDetailsFilters = async (filters: any) => {
    if (new Date(filters.fromDate) < new Date(filters.toDate)) {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 2);
      setSingleDate(newDate);
    } else {
      setSingleDate(filters.fromDate);
    }
    if (filters.fromDate) setFromDate(filters.fromDate);
    if (filters.toDate) setToDate(filters.toDate);
    if (filters.user) setSelectedUsers(filters.user);
    if (filters.expenseType) setExpenseType(filters.expenseType);
    if (filters.status) setStatus(filters.status);
    if (filters.formType) setSelectedFormType(filters.formType);
  };
  const updateRange = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    setFromDate(start);
    setToDate(end);
  };

  const handlePrev = () => {
    setSingleDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 1);
      updateRange(newDate);
      return newDate;
    });
  };

  const handleNext = () => {
    setSingleDate((prev) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const nextDate = new Date(prev);
      nextDate.setDate(prev.getDate() + 1);

      if (nextDate > today) {
        return prev;
      }

      updateRange(nextDate);
      return nextDate;
    });
  };

  useEffect(() => {
    refetch();
  }, [selectedUsers, expenseType, fromDate, toDate, status, selectedFormTpe, refetch]);

  // Format date range display
  const formatDateRange = () => {
    const from = dayjs(fromDate);
    const to = dayjs(toDate);

    if (from.isSame(to, "day")) {
      return from.format("DD MMM YYYY");
    }
    return `${from.format("DD MMM YYYY")} - ${to.format("DD MMM YYYY")}`;
  };

  // Get expense type badge
  const getExpenseBadge = (user: any) => {
    const types = [];
    if (user.officeExpenseDetails?.length > 0) types.push("Office");
    if (user.travelExpenseDetails?.length > 0) types.push("Travel");
    if (user.toPayExpenseDetails?.length > 0) types.push("ToPay");

    if (types.length === 0) types.push("None");

    const typeMap: Record<string, { bg: string; text: string }> = {
      Office: { bg: "bg-purple-100", text: "text-purple-800" },
      Travel: { bg: "bg-purple-100", text: "text-purple-800" },
      ToPay: { bg: "bg-yellow-100", text: "text-yellow-800" },
      Multiple: { bg: "bg-cyan-100", text: "text-gray-800" },
      None: { bg: "bg-gray-100", text: "text-gray-800" },
    };

    const displayType = types.length === 1 ? types[0] : types.join(" ");
    const { bg, text } = typeMap[displayType] || typeMap["Multiple"];

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${bg} ${text}`}>
        {displayType
          .split(" ")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" &  ")}
      </span>
    );
  };

  // Calculate user period net
  const calculateUserPeriodNet = (user: any) => {
    const credit = calculateCreditDebit(user.creditDetails);
    const debit = calculateCreditDebit(user.debitDetails);
    const office = calculateExpenses(user.officeExpenseDetails);
    const travel = calculateExpenses(user.travelExpenseDetails);
    const toPay = calculateExpenses(user.toPayExpenseDetails);

    return credit - debit - office - travel - toPay;
  };

  return (
    <section className="flex flex-col bg-gray-50 min-h-screen -mt-12  md:-mt-0">
      <div className="flex flex-col md:flex-row flex-grow">
        <Sidebar />
        <div className="flex-1 p-4 overflow-hidden">
          {isLoading && <Loader />}

          {/* Overview Cards */}
          <div className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 mt-12 md:mt-0">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <h3 className="text-gray-600 text-sm font-medium">Total Users</h3>
              <p className="text-2xl font-bold mt-1">{overview.totalUsers}</p>
            </div>

            <div
              className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setTransactionSummaryData({
                  data: resultData?.result,
                  type: "Credit",
                });
              }}
            >
              <h3 className="text-gray-600 text-sm font-medium">
                Total Credit
              </h3>
              <p className="text-2xl font-bold mt-1 text-green-600">
                ₹{overview.totalCredit.toLocaleString("en-IN")}
              </p>
            </div>

            <div
              className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setTransactionSummaryData({
                  data: resultData?.result,
                  type: "Debit",
                });
              }}
            >
              <h3 className="text-gray-600 text-sm font-medium">Total Debit</h3>
              <p className="text-2xl font-bold mt-1 text-red-600">
                ₹{overview.totalDebit.toLocaleString("en-IN")}
              </p>
            </div>

            <div
              className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSummaryData({ data: resultData?.result, type: "Office" });
              }}
            >
              <h3 className="text-gray-600 text-sm font-medium">
                Office Expense
              </h3>
              <p className="text-2xl font-bold mt-1">
                ₹{overview.totalOfficeExpense.toLocaleString("en-IN")}
              </p>
            </div>

            <div
              className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSummaryData({ data: resultData?.result, type: "Travel" });
              }}
            >
              <h3 className="text-gray-600 text-sm font-medium">
                Travel Expense
              </h3>
              <p className="text-2xl font-bold mt-1">
                ₹{overview.totalTravelExpense.toLocaleString("en-IN")}
              </p>
            </div>

            <div
              className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSummaryData({ data: resultData?.result, type: "ToPay" });
              }}
            >
              <h3 className="text-gray-600 text-sm font-medium">
                ToPay Expense
              </h3>
              <p className="text-2xl font-bold mt-1">
                ₹{overview.totalToPayExpense.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <div className="md:hidden flex  relative text-2xl text-purple-500 mb-4 cursor-pointer my-4 items-center justify-center animate-bounce  ">
            <FaArrowAltCircleDown />
          </div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-bold text-gray-800 text-center m-auto md:m-0">
              Account Dashboard
            </h2>
            <div>
              <span className="flex whitespace-nowrap  max-w-32 md:max-w-64 overflow-auto scroll-hidden text-gray-600">
                Filter Applied:{" "}
                {expenseType !== "all" ? `, ${expenseType} Expense` : ""}{" "}
                {status ? `, ${status} Status` : ""}{" "}
                {fromDate && toDate
                  ? `, From ${dayjs(fromDate).format("DD MMM YYYY")} To ${dayjs(
                    toDate
                  ).format("DD MMM YYYY")}`
                  : ""}
                {selectedFormTpe.length > 0
                  ? `, Form Type: ${selectedFormTpe.join(", ")}`
                  : ""}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {singleDate > new Date() ? (
                <button
                  onClick={() => {
                    setSingleDate(new Date());
                    updateRange(new Date());
                  }}
                  className="p-2 bg-purple-500 shadow-md rounded-full text-white"
                >
                  Today
                </button>
              ) : (
                <div className="flex gap-4 items-center bg-gray-300 shadow-sm rounded-md p-1">
                  <motion.span
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePrev}
                    className="cursor-pointer bg-purple-600 text-white rounded-full shadow-md py-1 px-2 text-xs "
                  >
                    Prev
                  </motion.span>
                  <span className="text-black">
                    {singleDate.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>

                  <motion.span
                    whileTap={{ scale: 0.9 }}
                    onClick={handleNext}
                    className="cursor-pointer bg-purple-600 text-white rounded-full shadow-md py-1 px-2 text-xs "
                  >
                    Next
                  </motion.span>
                </div>
              )}
              <motion.span
                onClick={(e) => {
                  e.stopPropagation(),
                    setSelectedUsers([]),
                    setFromDate(new Date()),
                    setToDate(new Date()),
                    setExpenseType("all");
                  setStatus("");
                }}
                whileTap={{ rotate: 120 }}
                className="text-3xl text-purple-500"
              >
                <MdOutlineRefresh />
              </motion.span>

              <AccountDashboardFilterModal
                onApplyTransactionDetailsFilters={
                  onApplyTransactionDetailsFilters
                }
                initialValues={{
                  fromDate: dayjs(fromDate),
                  toDate: dayjs(toDate),
                  user: selectedUsers,
                  expenseType,
                  status: "",
                }}
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-lg shadow overflow-x-auto max-h-[80vh] md:max-h-[70vh] overflow-auto mb-4">
            <table className="max-w-full divide-y divide-gray-200 ">
              <thead className="bg-gradient-to-r from-purple-600 to-purple-500 text-white sticky z-10 top-0 left-0 overflow-hidden">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Current Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Expense Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Total Credit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Total Debit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Total Office Expense
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Total Travel Expense
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Total ToPay Expense
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {resultData?.result.map((row: any) => {
                  const amount =
                    (calculateCreditDebit(row.creditDetails) || 0) -
                    (calculateCreditDebit(row.debitDetails) || 0);
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 flex flex-col gap-1">
                        {formatDateRange()}
                        <span className="flex items-center justify-center rounded-full bg-purple-500 text-white">
                          {(() => {
                            const from = new Date(fromDate);
                            const to = new Date(toDate);
                            const diffTime = Math.abs(
                              to.getTime() - from.getTime()
                            );
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
                              return `${diffDays - 1} day${diffDays > 1 ? "s" : ""
                                }`;
                            }
                          })()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 flex gap-2">
                        <span
                          className={`flex items-center w-12 ${Number(row.balance) > 0
                            ? "text-green-600"
                            : "text-red-600"
                            }`}
                        >
                          ₹{row.balance.toLocaleString("en-IN")}
                        </span>
                        <button
                          className="ml-2 bg-purple-600 hover:bg-purple-700 rounded-full shadow-md p-2 border-0 text-white text-xs transition-all"
                          onClick={() => {
                            setUserData({
                              _id: row._id,
                              name: row.name,
                              role: row.role,
                              phone: row.phone,
                              email: row.email,
                            });
                          }}
                        >
                          Pay
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getExpenseBadge(row)}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-sm text-green-600 "
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountData({
                            transaction: row.creditDetails,
                            transactionType: "credit",
                          });
                        }}
                      >
                        <span className="w-16">
                          ₹
                          {calculateCreditDebit(
                            row.creditDetails
                          ).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-black ">^</span>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-sm text-red-600  "
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountData({
                            transaction: row.debitDetails,
                            transactionType: "debit",
                          });
                        }}
                      >
                        <span className="w-16">
                          ₹
                          {calculateCreditDebit(
                            row.debitDetails
                          ).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-black ">^</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm relative">
                        <DayBalanceCard
                          fromDate={queryParams.fromDate}
                          toDate={queryParams.toDate}
                          userId={row._id}
                        />
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-sm text-red-500 "
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentData({
                            expenseDetails: row.officeExpenseDetails,
                            expenseType: "Office",
                          });
                        }}
                      >
                        <span className="w-16">
                          ₹
                          {calculateExpenses(
                            row.officeExpenseDetails
                          ).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-black ">^</span>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-sm text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentData({
                            expenseDetails: row.travelExpenseDetails,
                            expenseType: "Travel",
                          });
                        }}
                      >
                        <span className="w-16">
                          ₹
                          {calculateExpenses(
                            row.travelExpenseDetails
                          ).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-black ">^</span>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-sm text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentData({
                            expenseDetails: row.toPayExpenseDetails,
                            expenseType: "ToPay",
                          });
                        }}
                      >
                        <span className="w-16">
                          ₹
                          {calculateExpenses(
                            row.toPayExpenseDetails
                          ).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-black ">^</span>
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${calculateUserPeriodNet(row) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                          }`}
                      >
                        ₹{calculateUserPeriodNet(row).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {resultData?.result.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No transactions found matching your filters
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {currentData && (
        <AdminAccountDetailsModal
          closeModal={() => setCurrentData(null)}
          accountData={currentData}
        />
      )}
      {userData && (
        <CreditModal closeModal={() => setUserData(null)} userData={userData} />
      )}
      {accountData && (
        <TransactionDetailsModal
          closeModal={() => setAccountData(null)}
          accountData={accountData}
        />
      )}
      {summaryData && (
        <SummaryDetailsModal
          closeModal={() => setSummaryData(null)}
          summaryData={summaryData}
        />
      )}
      {transactionSummaryData && (
        <TransactionSummaryDetailsModal
          closeModal={() => setTransactionSummaryData(null)}
          summaryData={transactionSummaryData}
        />
      )}
    </section>
  );
}
