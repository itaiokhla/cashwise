"use client";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Loader from "@app/_components/Loader";
import client from "@createRequest";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiUserPlus, FiX } from "react-icons/fi";
import axios from "axios";
import Cookies from "js-cookie";
import Sidebar from "@app/_components/Sidebar";
import { GiCash } from "react-icons/gi";
import MoneyTransferModal from "@app/_components/AccountComp/CreditModal";
import CreditModal from "@app/_components/AccountComp/CreditModal";
import { selectUser, setUser } from "@redux/users/userSlice";
import { IUsers } from "@app/_interface/user.interface";
import { useForm } from "react-hook-form";
import { useAppSelector } from "@redux/redux.hooks";

const iconVariants = {
  hover: { rotate: 90 },
  tap: { rotate: -90 },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.3 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
export default function Account() {
  const user = useAppSelector(selectUser);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<IUsers>();
  const [users, setUsers] = useState<IUsers[]>([]);
  const [creditModal, setCreditModal] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const Error = (data: any) => toast.error(data);
  const Success = (data: any) => toast.success(data);
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { type: "office", name: "" },
  });
  const openCreditModal = (item: IUsers) => {
    setSelectedUsers(item);
    setCreditModal(true);
  };

  // function for close forgot password modal
  const closeCreditModal = () => {
    setCreditModal(false);
  };

  const watchName = watch("name");
  const watchType = watch("type");
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await client.get("/account", {
          params: { type: watchType, name: watchName },
        });
        if (response.status === 200) {
          const userData = ((response as any)?.data?.result as IUsers[]) || [];
          setUsers(userData);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        Error("Please Refresh Page to load data!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [watchName, watchType]);
  const calculateMoney = (item: any) => {
    let totalOfficeCreditMoney = 0;
    let totalOfficeDebitMoney = 0;
    let totalTravelCreditMoney = 0;
    let totalTravelDebitMoney = 0;
    let totalToPayDebitMoney = 0;
    let totalToPayCreditMoney = 0;
    let totalOtherDebitMoney = 0;
    let totalOtherCreditMoney = 0;
    let balance = 0;

    // Calculate total credit money based on reason
    (item.credit || []).forEach((creditItem: any) => {
      const creditSum = creditItem.transactionDetails.reduce(
        (acc: number, transaction: any) => {
          if (transaction.reason === "office") {
            totalOfficeCreditMoney += transaction.money || 0;
          } else if (transaction.reason === "travel") {
            totalTravelCreditMoney += transaction.money || 0;
          } else if (transaction.reason === "toPay") {
            totalToPayCreditMoney += transaction.money || 0;
          } else {
            totalOtherCreditMoney += transaction.money || 0;
          }
          return acc;
        },
        0
      );
    });

    // Calculate total debit money based on reason
    (item.debit || []).forEach((debitItem: any) => {
      const debitSum = debitItem.transactionDetails.reduce(
        (acc: number, transaction: any) => {
          if (transaction.reason === "office") {
            totalOfficeDebitMoney += transaction.money || 0;
          } else if (transaction.reason === "travel") {
            totalTravelDebitMoney += transaction.money || 0;
          } else if (transaction.reason === "toPay") {
            totalToPayDebitMoney += transaction.money || 0;
          } else {
            totalOtherDebitMoney += transaction.money || 0;
          }
          return acc;
        },
        0
      );
    });

    // Calculate balances
    const balanceOffice = Math.round(
      totalOfficeCreditMoney - totalOfficeDebitMoney
    );
    const balanceTravel = Math.round(
      totalTravelCreditMoney - totalTravelDebitMoney
    );
    const balanceToPay = Math.round(
      totalToPayCreditMoney - totalToPayDebitMoney
    );
    const balanceOther = Math.round(
      totalOtherCreditMoney - totalOtherDebitMoney
    );
    balance = Math.round(
      balanceOffice + balanceTravel + balanceToPay + balanceOther
    );
    return {
      totalOfficeCreditMoney,
      totalOfficeDebitMoney,
      totalTravelCreditMoney,
      totalTravelDebitMoney,
      totalToPayCreditMoney,
      totalToPayDebitMoney,
      totalOtherCreditMoney,
      totalOtherDebitMoney,
      balanceOffice,
      balanceTravel,
      balanceToPay,
      balanceOther,
      balance,
    };
  };
  return (
    <div className="flex flex-col max-h-screen bg-gray-50">
      <div className="flex flex-col md:flex-row flex-grow">
        {isLoading && <Loader />}
        <Sidebar />

        <motion.div
          className="flex-1 p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-2 items-center justify-around mb-4 border-b-2 pb-4">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                Account
              </h1>

              <div className="flex gap-2">
                <div className="border border-gray-400 p-2 rounded-md shadow-md">
                  <select
                    className="border-none focus:outline-none focus:ring-0 px-2"
                    {...register("type")}
                  >
                    <option value="">All</option>
                    <option value="office">Office</option>
                    <option value="travel">Travel</option>
                    <option value="toPay">To Pay</option>
                  </select>
                </div>
                <div>
                  <motion.button
                    whileTap={{ scale: 0.89 }}
                    className="text-white bg-purple-500 p-2 rounded-md shadow-md"
                    onClick={() => {
                      setShowDetails(!showDetails);
                    }}
                  >
                    {showDetails ? "Hide Details" : "Show Details"}
                  </motion.button>
                </div>
              </div>
              <div className="flex items-center relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                <input
                  type="text"
                  // value={searchTerm}
                  // onChange={handleSearch}
                  placeholder="Search employees..."
                  className="pl-10 pr-4 py-2 rounded-lg shadow-sm border border-gray-600 focus:outline-none focus:ring focus:ring-violet-500 focus:border-violet-500 transition-colors"
                  {...register("name")}
                  // onFocus={() => setIsSearchFocused(true)}
                  // onBlur={() => setIsSearchFocused(false)}
                />
              </div>
            </div>

            {/* User Cards Grid */}
            <motion.div
              className={`grid grid-cols-1 md:grid-cols-2 ${
                showDetails ? "lg:grid-cols-3" : "lg:grid-cols-4"
              } gap-4 overflow-auto h-[70vh]`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatePresence>
                {Array.isArray(users) &&
                  users.map(
                    (item: any, index) =>
                      item && (
                        <motion.div
                          key={index}
                          variants={itemVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0 }}
                          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                        >
                          <div className="flex items-start gap-4">
                            {showDetails && (
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-purple-400 flex items-center justify-center text-white font-bold">
                                  {item.name?.charAt(0) || "U"}
                                </div>
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex flex-col gap-4">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-800 capitalize">
                                    {item.name || "Anonymous"}{" "}
                                    <span className="text-gray-500 text-sm">
                                      {" "}
                                      ({item.type})
                                    </span>
                                  </h3>
                                  {showDetails && (
                                    <p className="text-sm text-gray-500 truncate">
                                      {item.phone}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <motion.button
                                    whileTap={{ scale: 0.8 }}
                                    className="bg-yellow-500 text-white px-2 py-1 rounded-md flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCreditModal(item);
                                    }}
                                  >
                                    <GiCash className="w-4 h-4 mr-1" />
                                    Credit
                                  </motion.button>
                                </div>
                              </div>
                              <div
                                className={`mt-4 grid grid-cols-2 gap-3 -ml-6 ${
                                  user.role === "admin" ||
                                  user.role === "manager" ||
                                  user.phone === item.phone
                                    ? ""
                                    : "hidden"
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (
                                    user.role === "admin" ||
                                    user.role === "manager" ||
                                    user.phone === item.phone
                                  ) {
                                    e.stopPropagation();
                                    window.open(
                                      `/account/transactiondetails/${item._id}`,
                                      "_blank"
                                    );
                                  }
                                }}
                              >
                                {(user.role === "admin" ||
                                  user.role === "manager" ||
                                  user.phone === item.phone) && (
                                  <>
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500 ">
                                          Travel Credit
                                        </span>
                                        <p className="font-medium text-green-500">
                                          +
                                          {
                                            calculateMoney(item)
                                              .totalTravelCreditMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500">
                                          Travel Debit
                                        </span>
                                        <p className="font-medium text-red-500">
                                          -
                                          {
                                            calculateMoney(item)
                                              .totalTravelDebitMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500 ">
                                          Office Credit
                                        </span>
                                        <p className="font-medium text-green-500">
                                          +
                                          {
                                            calculateMoney(item)
                                              .totalOfficeCreditMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500">
                                          Office Debit
                                        </span>
                                        <p className="font-medium text-red-500">
                                          -
                                          {
                                            calculateMoney(item)
                                              .totalOfficeDebitMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500 ">
                                          To Pay Credit
                                        </span>
                                        <p className="font-medium text-green-500">
                                          +
                                          {
                                            calculateMoney(item)
                                              .totalToPayCreditMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500">
                                          To Pay Debit
                                        </span>
                                        <p className="font-medium text-red-500">
                                          -
                                          {
                                            calculateMoney(item)
                                              .totalToPayDebitMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500 ">
                                          Others Credit
                                        </span>
                                        <p className="font-medium text-green-500">
                                          +
                                          {
                                            calculateMoney(item)
                                              .totalOtherCreditMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    {showDetails && (
                                      <div className="space-y-1 text-center">
                                        <span className="text-xs text-gray-500">
                                          Others Debit
                                        </span>
                                        <p className="font-medium text-red-500">
                                          -
                                          {
                                            calculateMoney(item)
                                              .totalOtherDebitMoney
                                          }{" "}
                                          ₹
                                        </p>
                                      </div>
                                    )}
                                    <div className="space-y-1 text-center">
                                      <span className="text-xs text-gray-500">
                                        Balance
                                      </span>
                                      <p
                                        className={`font-medium text-gray-700 ${
                                          calculateMoney(item).balance > 0
                                            ? "text-green-400"
                                            : "text-red-500"
                                        }`}
                                      >
                                        {calculateMoney(item).balance} ₹
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                  )}
              </AnimatePresence>
            </motion.div>

            {/* Empty State */}
            {users.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="mb-4 text-gray-400 mx-auto">
                  <FiUserPlus className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Users found
                </h3>
                <p className="text-gray-500">
                  Try adjusting your search or add a new Users
                </p>
              </motion.div>
            )}
          </div>

          {/* <CreateUser isModalOpen={isModalOpen} toggleModal={toggleCreateUserModal} /> */}

          {/* Data Table Overlay */}
          {/* <AnimatePresence>
          {selectedUsers && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
                <button
                  onClick={closeExpandedCard}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
                <DataTable 
                  onClose={closeExpandedCard} 
                  userDataTable={CustomerExpense} 
                  DownloadButton={DownloadButton} 
                  id={selectedCustomer._id} 
                  Download={DownloadButtons} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence> */}
        </motion.div>
      </div>
      {creditModal && selectedUsers && (
        <CreditModal closeModal={closeCreditModal} userData={selectedUsers} />
      )}
    </div>
  );
}
