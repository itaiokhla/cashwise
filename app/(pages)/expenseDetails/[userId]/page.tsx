"use client";
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCloseLine } from "react-icons/ri";
import { CiFilter } from "react-icons/ci";
import { MdDownload } from "react-icons/md";
import { LuFilterX } from "react-icons/lu";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import EmployeeTable from "@app/_components/EmployeeTable";
import Sidebar from "@app/_components/Sidebar";
import client from "@createRequest";
import { usePathname, useRouter } from "next/navigation";
import ExpenseModal from "@app/_components/EmployeeTable";
import ExpensesDownload from "@app/_components/ExpensesDownload";
import { FaArrowLeft } from "react-icons/fa";

const DataTable = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [filterModal, setFilterModal] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [officeExpense, setOfficeExpense] = useState([]);
  const [travelExpense, setTravelExpense] = useState([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalTravelExpense, setTotalTravelExpense] = useState(0);
  const [totalOfficeExpense, setTotalOfficeExpense] = useState(0);
  const [rowData, setRowData] = useState();
  const [dataFilter, setDataFilter] = useState<{
    startDate: Date | null;
    endDate: Date | null;
    type: string;
  }>({
    startDate: null,
    endDate: null,
    type: "",
  });

  const openEmployeeModal = (item: any) => {
    setRowData(item);
    setEmployeeModal(true);
  };
  const closeEmployeeModal = () => {
    setEmployeeModal(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      const urlSegments = pathname.split("/");
      const userId = urlSegments[2];
      if (!userId) {
        console.error("Customer ID not found in URL");
        return;
      }
      setIsLoading(true);
      try {
        // Fetch user-specific expense details
        const response = await client.get("/employeedashboard", {
          params: { userId },
        });
        if (response.status === 200) {
          const resultData = await (response as any)?.data;
          setOfficeExpense(resultData?.officeExpenses);
          setTravelExpense(resultData?.travelExpenses);
          setTotalTravelExpense(resultData?.totalTravelExpense);
          setTotalOfficeExpense(resultData?.totalOfficeExpense);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        // Error()
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [pathname]);
  const handleApplyFilters = async () => {
    setIsLoading(true);
    const urlSegments = pathname.split("/");
    const userId = urlSegments[2];
    if (!userId) {
      console.error("Customer ID not found in URL");
      return;
    }
    try {
      const response = await client.get("/employeedashboard", {
        params: {
          userId,
          fromDate: dataFilter.startDate,
          toDate: dataFilter.endDate,
          type: dataFilter.type,
        },
      });
      if (response.status === 200) {
        const resultData = await (response as any)?.data;
        setOfficeExpense(resultData?.officeExpenses);
        setTravelExpense(resultData?.travelExpenses);
        setTotalTravelExpense(resultData?.totalTravelExpense);
        setTotalOfficeExpense(resultData?.totalOfficeExpense);
        setFilterModal(false);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Error()
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex max-h-screen my-12 md:my-0">
      <Sidebar />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg overflow-hidden w-full"
      >
        <div className="p-6">
          {/* Header Section */}
          <motion.div
            className="flex  items-start  justify-between mb-6 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              onClick={(e) => {
                router.push("/admin");
              }}
              className="flex items-center gap-2 text-purple-600 "
            >
              <FaArrowLeft />
              Go Back
            </button>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
              Expense Sheet
            </h3>

            <div className="flex items-center gap-3">
              {/* <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilterModal(false)}
                className="p-2 text-violet-600 hover:bg-violet-100 rounded-lg"
              >
                <LuFilterX className="text-xl" />
              </motion.button>
               */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="-mt-4 text-violet-600 hover:bg-violet-100 rounded-lg"
                onClick={() => setFilterModal(!filterModal)}
              >
                <CiFilter className="text-3xl" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* <MdDownload className="text-xl" /> */}
                <ExpensesDownload
                  officeData={officeExpense}
                  travelData={travelExpense}
                />
              </motion.button>
            </div>
          </motion.div>

          {/* Table Section */}
          <div className="max-h-[67vh] overflow-y-auto ">
            <table className="w-full border-collapse text-sm h-full">
              <thead className="bg-gray-200 border-b-2 border-gray-300 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700 whitespace-nowrap">
                    S No.
                  </th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">
                    Type
                  </th>
                  {[
                    "Conveyance1",
                    "Conveyance2",
                    "Purchase1",
                    "Purchase2",
                    "Food",
                    "Food with Staff",
                    "Tea",
                    "Labour",
                    "Hotel",
                    "Courier",
                    "Loading",
                    "Un-Loading",
                    "Porter",
                    "Cartage",
                    "Rider",
                    "Daily Wages",
                    "Transport",
                    "Maintenance",
                    "Other1",
                    "Other2",
                    "Miscellaneous1",
                    "Miscellaneous2",
                  ].map((header) => (
                    <th
                      key={header}
                      className="p-3  text-sm font-semibold text-gray-700 whitespace-nowrap text-center"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className=" divide-y divide-gray-300">
                {officeExpense &&
                  officeExpense.length > 0 &&
                  officeExpense.map((item: any, index: number) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ backgroundColor: "#faf9ff" }}
                      className="cursor-pointer"
                      onClick={() => openEmployeeModal(item)}
                    >
                      <td className="p-3 text-sm text-gray-600 whitespace-nowrap text-center">
                        {index + 1}
                      </td>
                      <td className="p-3 text-sm text-gray-800 whitespace-nowrap text-center">
                        {item.date}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                          Office
                        </span>
                      </td>
                      {[
                        "convenance1",
                        "convenance2",
                        "purchase1",
                        "purchase2",
                        "food",
                        "foodWithStaff",
                        "tea",
                        "labour",
                        "hotel",
                        "courier",
                        "loading",
                        "unloading",
                        "porter",
                        "cartage",
                        "rider",
                        "dailyWages",
                        "transport",
                        "maintenance",
                        "other1",
                        "other2",
                        "miscellaneous1",
                        "miscellaneous2",
                      ].map((key) => (
                        <td
                          key={key}
                          className="p-3 text-right text-sm text-gray-600 whitespace-nowrap text-center"
                        >
                          {item[key].length} / ₹
                          {item[key].reduce(
                            (sum: number, i: any) => sum + (i.amount || 0),
                            0
                          )}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                {travelExpense &&
                  travelExpense.length > 0 &&
                  travelExpense.map((item: any, index: number) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ backgroundColor: "#faf9ff" }}
                      className="cursor-pointer"
                      onClick={() => openEmployeeModal(item)}
                    >
                      <td className="p-3 text-sm text-gray-600 whitespace-nowrap text-center">
                        {officeExpense.length + index + 1}
                      </td>
                      <td className="p-3 text-sm text-gray-800 whitespace-nowrap text-center">
                        {item.date}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                          Travel
                        </span>
                      </td>
                      {[
                        "convenance1",
                        "convenance2",
                        "purchase1",
                        "purchase2",
                        "food",
                        "foodWithStaff",
                        "tea",
                        "labour",
                        "hotel",
                        "courier",
                        "loading",
                        "unloading",
                        "porter",
                        "cartage",
                        "rider",
                        "dailyWages",
                        "transport",
                        "maintenance",
                        "other1",
                        "other2",
                        "miscellaneous1",
                        "miscellaneous2",
                      ].map((key) => (
                        <td
                          key={key}
                          className="p-3 text-right text-sm text-gray-600 whitespace-nowrap text-center"
                        >
                          {item[key].length} / ₹
                          {item[key].reduce(
                            (sum: number, i: any) => sum + (i.amount || 0),
                            0
                          )}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
      {/* Filter Dropdown */}
      <AnimatePresence>
        {filterModal && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-xl p-6 shadow-lg max-w-sm"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold text-violet-800">
                  Filters
                </h4>
                <RiCloseLine
                  className="text-red-500 cursor-pointer text-xl"
                  onClick={() => setFilterModal(false)}
                />
              </div>

              {/* Filter Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-2">
                    Start Date
                  </label>
                  <DatePicker
                    selected={dataFilter.startDate}
                    onChange={(date) =>
                      setDataFilter((prev) => ({ ...prev, startDate: date }))
                    }
                    className="w-full p-2 border border-violet-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-2">
                    End Date
                  </label>
                  <DatePicker
                    selected={dataFilter.endDate}
                    onChange={(date) =>
                      setDataFilter((prev) => ({ ...prev, endDate: date }))
                    }
                    className="w-full p-2 border border-violet-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-2">
                    Expense Type
                  </label>
                  <select
                    value={dataFilter.type}
                    onChange={(e) =>
                      setDataFilter((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-violet-200 rounded-lg"
                  >
                    <option value="" disabled>
                      Select Expense Type
                    </option>
                    <option value="office">Office</option>
                    <option value="travel">Travel</option>
                  </select>
                </div>
              </div>

              {/* Apply Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-violet-600 text-white py-2 rounded-lg font-medium mt-4"
                onClick={handleApplyFilters}
              >
                Apply Filters
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {employeeModal && (
        <EmployeeTable onClose={closeEmployeeModal} rowData={rowData} />
      )}
    </div>
  );
};

export default DataTable;
