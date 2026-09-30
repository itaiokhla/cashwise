"use client";
import ls from "localstorage-slim";
import Sidebar from "@app/_components/Sidebar";
import EmployeeTable from "@app/_components/EmployeeTable";
import Loader from "@app/_components/Loader";
import client from "@createRequest";
import { RiCloseLine } from "react-icons/ri";
import { CiFilter } from "react-icons/ci";
import { MdDownload } from "react-icons/md";
import { LuFilterX } from "react-icons/lu";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import { motion, AnimatePresence } from "framer-motion";
import ExpensesDownload from "@app/_components/ExpensesDownload";

export default function EmployeeDashboard() {
  const Error = (data: any) => toast.error(data);
  const Success = (data: any) => toast.success(data);
  const user = useAppSelector(selectUser);
  const [officeExpense, setOfficeExpense] = useState([]);
  const [travelExpense, setTravelExpense] = useState([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalTravelExpense, setTotalTravelExpense] = useState(0);
  const [totalOfficeExpense, setTotalOfficeExpense] = useState(0);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);

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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch user-specific expense details
        const response = await client.get("/employeedashboard", {
          params: { userId: user._id },
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
  }, [user]);

  const openEmployeeModal = (item: any) => {
    setRowData(item);
    setEmployeeModal(true);
  };
  const closeEmployeeModal = () => {
    setEmployeeModal(false);
  };
  const handleApplyFilters = async () => {
    setIsLoading(true);

    try {
      const response = await client.get("/employeedashboard", {
        params: {
          userId: user._id,
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
    <section className="flex max-h-screen bg-gray-50 ">
      <Sidebar />
      {isLoading && <Loader />}

      <main className="flex-1 mt-16 md:mt-4">
        <div className="w-[96vw] md:w-[77vw] mx-auto ">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-2 ">
            <div className="flex md:block mb-2">
              <h1 className="text-xl font-bold text-gray-800">
                Expense Dashboard
              </h1>
              <p className="text-md font-medium bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent ml-4 ">
                [{user?.name || "User"}]
              </p>
            </div>
            {/* Totals Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">
                    Office Expense
                  </p>
                  <p className="text-lg font-semibold text-purple-600">
                    ₹{totalOfficeExpense.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">
                    Travel Expense
                  </p>
                  <p className="text-lg font-semibold text-purple-600">
                    ₹{totalTravelExpense.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-center items-center gap-4">
                {/* Filters Section */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="-mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                  onClick={() => setFilterModal(true)}
                >
                  <CiFilter className="text-lg" />
                </motion.button>
                <ExpensesDownload
                  officeData={officeExpense}
                  travelData={travelExpense}
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-200">
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
                    {/* Simplify headers */}
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
                    {/* <th className="p-3 text-right text-sm font-semibold text-gray-700">Total</th> */}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {[...officeExpense, ...travelExpense].map(
                    (item: any, index: number) => (
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
                            {item.type || "Office"}
                          </span>
                        </td>
                        {/* Simplified cells */}
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
                        {/* <td className="p-3 text-right font-medium text-violet-700">
                      </td> */}
                      </motion.tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Filter Modal */}
        <AnimatePresence>
          {filterModal && (
            <motion.div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-xl p-6 w-full max-w-md"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Filter Expenses</h3>
                  <button onClick={() => setFilterModal(false)}>
                    <RiCloseLine className="text-gray-500 hover:text-gray-700" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date Range
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <DatePicker
                        selected={dataFilter.startDate}
                        onChange={(date) =>
                          setDataFilter((prev) => ({
                            ...prev,
                            startDate: date,
                          }))
                        }
                        placeholderText="Start Date"
                        className="w-full p-2 border rounded-lg"
                      />
                      <DatePicker
                        selected={dataFilter.endDate}
                        onChange={(date) =>
                          setDataFilter((prev) => ({ ...prev, endDate: date }))
                        }
                        placeholderText="End Date"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
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
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="">All Types</option>
                      <option value="office">Office</option>
                      <option value="travel">Travel</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setFilterModal(false)}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyFilters}
                      className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {employeeModal && (
          <EmployeeTable onClose={closeEmployeeModal} rowData={rowData} />
        )}
      </main>
    </section>
  );
}
