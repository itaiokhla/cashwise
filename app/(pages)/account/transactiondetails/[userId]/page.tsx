"use client";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Loader from "@app/_components/Loader";
import Sidebar from "@app/_components/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import client from "@createRequest";
import { toast } from "react-toastify";
import { FaArrowLeft } from "react-icons/fa";
import { selectUser } from "@redux/users/userSlice";
import { useAppSelector } from "@redux/redux.hooks";
import { FaFilter } from "react-icons/fa";
import TransactionFilterModal from "@app/_components/filter/TransactionFilter";
import CreditRow from "@app/_components/transactionTableRow/creditRow";
import DebitRow from "@app/_components/transactionTableRow/debitRow";
import ExpenseRow from "@app/_components/transactionTableRow/expenseRow";
import { MdFilterAltOff } from "react-icons/md";

export default function TransactionDetails() {
  const user = useAppSelector(selectUser);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<any>(null);
  const [toPayTransaction, setToPayTransaction] = useState<any>(null);
  const [officeTransaction, setOfficeTransaction] = useState<any>(null);
  const [travelTransaction, setTravelTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterOptionModal, setFilterOptionModal] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [limit, setLimit] = useState<number>(10);
  useEffect(() => {
    async function UserTranInfo() {
      const urlSegments = pathname.split("/");
      const userId = urlSegments[3];
      if (!userId) {
        console.error("Customer ID not found in URL");
        return;
      }
      setLoading(true);
      try {
        const response = await client.get("/account/transaction", {
          params: { userId, ...activeFilters, limit },
        });
        if (response.status === 200) {
          setAccount(response.data?.account);
          setToPayTransaction(response.data?.toPayExpense);
          setOfficeTransaction(response.data?.officeExpense);
          setTravelTransaction(response.data?.travelExpense);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Something went wrong!");
      } finally {
        setLoading(false);
      }
    }
    UserTranInfo();
  }, [pathname, activeFilters, limit]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };
  // filter function
  const onApplyTransactionDetailsFilters = async (appliedFilters: any) => {
    setFilterOptionModal(false);

    // Create cleaned filters object
    const cleanedFilters = Object.entries(appliedFilters).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>
    );

    setActiveFilters((prev) => ({
      ...prev,
      ...cleanedFilters,
    }));
  };
console.log("Account",account)
  return (
    <div className="flex flex-col max-h-screen bg-gray-50 mt-12 md:mt-0">
      <div className="flex flex-col md:flex-row flex-grow">
        {loading && <Loader />}
        <Sidebar />

        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-white w-full max-h-[80vh] md:max-h-[97vh] rounded-lg shadow-md overflow-hidden border border-gray-300 flex-grow"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <button
              onClick={(e) => {
                router.push("/account");
              }}
              className="flex items-center gap-2 text-purple-600 whitespace-nowrap"
            >
              <FaArrowLeft />
              Go Back
            </button>
            <div className="flex flex-wrap items-center justify-center mb-4">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-6 text-center"
              >
                Transaction History <br />
                <span className="text-sm text-gray-500">
                  {account?.name || "N/A"}
                </span>
              </motion.h1>
              <div className="flex items-center gap-2 ml-0 md:ml-4 md:-mt-12">
                {/* <div className="p-2 shadow-md rounded-md border border-gray-400  flex items-center gap-2 cursor-pointer">
                  <select  id="" 
                    onChange={(e) => setTransactionType(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                    <option value="officeExpense">Office Expense</option>
                    <option value="travelExpense">Travel Expense</option>
                    <option value="toPayExpense">To Pay Expense</option>
                    <option value="allExpense">All Expense</option>
                  </select>
                </div> */}
                {/* <div className="p-2 shadow-md rounded-md border border-gray-400  flex items-center gap-2 cursor-pointer">
                  <select  id="" 
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="focus:border-none focus:outline-none"
                  >
                    <option value="10">5</option>
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="25">25 </option>
                    <option value="30">30 </option>
                  </select>
                </div> */}

                <div>
                  <TransactionFilterModal
                    onApplyTransactionDetailsFilters={
                      onApplyTransactionDetailsFilters
                    }
                  />
                </div>
                <div>
                  <MdFilterAltOff
                    className="text-2xl text-red-500 cursor-pointer"
                    onClick={() => setActiveFilters({})}
                  />
                </div>
              </div>
            </div>
            <div className="max-h-[67vh] overflow-y-auto mb-2">
              <table className="w-full border-collapse text-sm h-full">
                <thead className="bg-gray-200 border-b-2 border-gray-300 sticky top-0 z-10 w-full">
                  <tr className="text-left border-b border-gray-400 w-full">
                    <th className="p-3 ">Name</th>
                    {/* <th className="p-3">Phone</th> */}
                    <th className="p-3 ">Date</th>
                    <th className="p-3 ">Amount</th>
                    <th className="p-3 ">Reason</th>
                    <th className="p-3 ">Remarks</th>
                    <th className="p-3 ">Description</th>
                    <th className="p-3 ">File</th>
                                        <th className="p-3 ">Tally</th>

                  </tr>
                </thead>
                <tbody className=" divide-y divide-gray-300">
                  {account?.credit && account?.credit?.length > 0 && (
                    <CreditRow
                      creditData={account?.credit}
                      user={{ phone: user?.phone?.toString() }}
                      name={{ name: account.name }}
                    />
                  )}
                  {account?.debit && account?.debit?.length > 0 && (
                    <DebitRow
                      debitData={account?.debit}
                      user={{ phone: user.phone?.toString() }}
                      name={{ name: account.name,userId:account?._id }}

                    />
                  )}
                  {/* {officeTransaction && officeTransaction.length > 0 && 
                    officeTransaction.map((items: any, index: number) => (
                      <ExpenseRow 
                        key={items._id}
                        expenseData={items}
                        name={{ name: user.phone?.toString()===account?.phone?.toString()?"Me":account?.name }}
                      />
                  } */}
                  {officeTransaction &&
                    officeTransaction.length > 0 &&
                    officeTransaction?.map((item: any) => (
                      <ExpenseRow
                        key={item._id}
                        expenseData={item}
                        name={
                          user.phone === account?.phone ? "Me" : account?.name
                        }
                        userName={account.name}
                        userId={account._id}
                      />
                    ))}
                  {travelTransaction &&
                    travelTransaction.length > 0 &&
                    travelTransaction?.map((item: any) => (
                      <ExpenseRow
                        key={item._id}
                        expenseData={item}
                        name={
                          user.phone === account?.phone ? "Me" : account?.name
                        }
                        userName={account.name}
                        userId={account._id}
                      />
                    ))}
                  {toPayTransaction &&
                    toPayTransaction.length > 0 &&
                    toPayTransaction?.map((item: any) => (
                      <ExpenseRow
                        key={item._id}
                        expenseData={item}
                        name={
                          user.phone === account?.phone ? "Me" : account?.name
                        }
                        userName={account.name}
                        userId={account._id}
                      />
                    ))}
                </tbody>
              </table>
            </div>

            {!account?.credit?.length ||
              (!account?.debit?.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <p className="text-gray-500">No transactions found</p>
                </motion.div>
              ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
