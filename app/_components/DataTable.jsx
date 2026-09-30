import React, { useEffect, useState, useRef, use } from "react";
import { RiCloseLine } from "react-icons/ri";
import { CiFilter } from "react-icons/ci";
import { MdDownload } from "react-icons/md";
import { LuFilterX } from "react-icons/lu";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import EmployeeTable from "./EmployeeTable";
import client from "@createRequest";

const DataTable = ({
  onClose,
  userDataTable,
  DownloadButton,
  id,
  Download,
}) => {
  const [dataTable, setDataTable] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dateFilter, setDateFilter] = useState(false);
  const [other, setOther] = useState(false);
  const [dataFilter, setDataFilter] = useState({
    startDate: null,
    endDate: null,
    minValue: "",
    maxValue: "",
    sitename: "",
    sitelocation: "",
  });

  const filterIconRef = useRef(null);
  const [dateSelect, setDateSelect] = useState([]);
  const [expenses, setExpenses] = useState(null);
  const [close, setClose] = useState(false);

  useEffect(() => {
    setDataTable(userDataTable);
  }, [userDataTable]);

  const handleRowClick = (customer) => {
    setSelectedCustomer(customer);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()); // Full 4-digit year
    return `${day}/${month}/${year}`;
  };

  const handleDeleteFilter = async () => {
    setDataFilter((prev) => ({
      ...prev,
      startDate: null,
      endDate: null,
      minValue: "",
      maxValue: "",
      sitelocation: "",
      sitename: "",
    }));
    try {
      const response = await client.get(`/userExpense?id=${id}`);
      if (response.status === 200) {
        setDataTable(response?.data);
      }
    } catch (error) {
      console.log("error to filter data table", error.response.data.message);
      alert(error.response.data.message);
      return;
    }
  };

  const applyDateFilter = async () => {
    setDateFilter(!dateFilter);
    try {
      const response = await client.get(`/userExpense?id=${id}`, {
        params: dataFilter,
      });
      if (response.status === 200) {
        setDataTable(response?.data);
      }
    } catch (error) {
      console.log("error to filter data table", error.response.data.message);
      alert(error.response.data.message);
      return;
    }
    // Assuming DownloadButton is a function to handle the download of filtered data
    // DownloadButton(filteredData);
  };

  const handleCloseEmployeeTable = () => {
    setExpenses(null);
    setSelectedCustomer(null);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center m-auto bg-black bg-opacity-50">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white p-6 rounded-lg shadow-lg w-full h-5/6 max-w-4xl overflow-y-auto relative ]"
      >
        <div className="flex items-center justify-between mb-4 ">
          <h3 className="text-xl font-semibold dark:text-black">
            Expense Sheet
          </h3>
          <div className="flex items-center space-x-2 relative">
            <button
              onClick={() => handleDeleteFilter()}
              className="w-8 h-8 flex items-center justify-center dark:text-black"
            >
              <LuFilterX className="text-2xl text-red-500" />
            </button>
            <button
              onClick={() => DownloadButton(dataTable)}
              className="w-8 h-8 flex items-center justify-center dark:text-black"
            >
              <MdDownload className="text-2xl" />
            </button>
            <button
              onClick={() => setDateFilter(!dateFilter)}
              ref={filterIconRef}
              className="w-8 h-8 flex items-center justify-center dark:text-black"
            >
              <CiFilter className="text-2xl text-violet-700 font-bold" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center dark:text-black"
            >
              <RiCloseLine className="text-2xl" />
            </button>
            {dateFilter && (
              <div
                className="absolute bg-white shadow-lg rounded-lg p-4 dark:text-black"
                style={{
                  left: "50%", // Centering the filter box
                  transform: "translateX(-50%)",
                  top: "40px", // Adjust as needed
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xl text-center font-bold text-violet-500 mb-2 dark:text-black">
                    Apply Filter
                  </h4>
                  <RiCloseLine
                    className="text-2xl cursor-pointer"
                    onClick={() => setDateFilter(!dateFilter)}
                  />
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <h3 className="text-violet-600 text-lg">Select Date</h3>
                  <div className="flex flex-wrap">
                    <div>
                      <label htmlFor="startdate">Start Date:</label>
                      <DatePicker
                        selected={dataFilter.startDate}
                        onChange={(date) =>
                          setDataFilter((prev) => ({
                            ...prev,
                            startDate: date,
                          }))
                        }
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select start date"
                        className="border border-gray-500 p-2"
                      />
                    </div>
                    <div>
                      <label htmlFor="enddate">End Date:</label>
                      <DatePicker
                        selected={dataFilter.endDate}
                        onChange={(date) =>
                          setDataFilter((prev) => ({ ...prev, endDate: date }))
                        }
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select end date"
                        className="border border-gray-500 p-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <h3 className="text-violet-600 text-lg">Select Advance</h3>
                  <div className="flex flex-wrap">
                    <div>
                      <label htmlFor="minvalue">Min Value</label>
                      <input
                        type="text"
                        placeholder="minimum value"
                        className="border border-gray-500 p-2"
                        value={dataFilter.minValue}
                        onChange={(e) =>
                          setDataFilter((prev) => ({
                            ...prev,
                            minValue: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="maxvalue">Max Value</label>
                      <input
                        type="text"
                        placeholder="maximum value"
                        className="border border-gray-500 p-2"
                        value={dataFilter.maxValue}
                        onChange={(e) =>
                          setDataFilter((prev) => ({
                            ...prev,
                            maxValue: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <label htmlFor="sitename" className="text-violet-600 text-lg">
                    Site Name
                  </label>
                  <select
                    name="sitename"
                    id="sitename"
                    className="border border-gray-500 p-2"
                    value={dataFilter.sitename}
                    onChange={(e) =>
                      setDataFilter((prev) => ({
                        ...prev,
                        sitename: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select Site Name</option>
                    <option value="AVAADA SOEGAON">AVAADA SOEGAON</option>
                    <option value="Kumbhirgram">Kumbhirgram</option>
                    <option value="Anish Saini">Anish Saini</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Jabalpur">Jabalpur</option>
                    <option value="other" onSelect={() => setOther(true)}>
                      Other
                    </option>
                  </select>
                  {other && (
                    <input
                      type="text"
                      className="border border-gray-500 p-2"
                      onChange={(e) =>
                        setDataFilter((prev) => ({
                          ...prev,
                          sitename: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <label
                    htmlFor="sitelocation"
                    className="text-violet-600 text-lg"
                  >
                    Site Location
                  </label>
                  <input
                    type="text"
                    className="border border-gray-500 p-2"
                    value={dataFilter.sitelocation}
                    onChange={(e) =>
                      setDataFilter((prev) => ({
                        ...prev,
                        sitelocation: e.target.value,
                      }))
                    }
                  />
                </div>

                <button
                  onClick={applyDateFilter}
                  className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
        <table className="min-w-full border-collapse border">
          <thead>
            <tr>
              <th className="border border-black p-2 dark:text-black">S No.</th>
              <th className="border border-black p-2 dark:text-black">Date</th>
              <th className="border border-black p-2 dark:text-black">
                Advance (₹)
              </th>
              <th className="border border-black p-2 dark:text-black">
                Site Name
              </th>
              <th className="border border-black p-2 dark:text-black">
                Site Location
              </th>
            </tr>
          </thead>
          <tbody>
            {dataTable.length > 0 ? (
              dataTable.map((item, index) => (
                <tr
                  key={index}
                  onClick={() => handleRowClick(item)}
                  className="border-t cursor-pointer hover:bg-gray-100"
                >
                  <td className="border border-black p-2 dark:text-black">
                    {index + 1}
                  </td>
                  <td className="border border-black p-2 dark:text-black">
                    {formatDate(item.date)}
                  </td>
                  <td className="border border-black p-2 dark:text-black">
                    {item.advancedReceived}
                  </td>
                  <td className="border border-black p-2 dark:text-black">
                    {item.siteName}
                  </td>
                  <td className="border border-black p-2 dark:text-black">
                    {item.siteLocation}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center p-4">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedCustomer && (
        <EmployeeTable
          customer={selectedCustomer}
          onClose={handleCloseEmployeeTable}
        />
      )}
    </div>
  );
};

export default DataTable;
