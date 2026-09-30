import client from "@createRequest";
import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { RxCross2 } from "react-icons/rx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaFileDownload } from "react-icons/fa";
import ExpenseLimitReport from "./ExpenseLimitReport";

const modalVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
    },
  },
  exit: { opacity: 0, y: 20 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export default function DownloadReportModal() {
  const [openModal, setOpenModal] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  return (
    <>
      <button 
        onClick={() => setOpenModal(true)}
        className="flex items-center gap-2 p-2 rounded-md text-white bg-gradient-to-r from-purple-500 to-purple-500 hover:from-purple-600 hover:to-purple-600 transition-all"
      >
        <FaFileDownload /> Download Reports
      </button>

      <AnimatePresence>
        {openModal && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setOpenModal(false)}
          >
            <motion.div
              variants={modalVariants}
              className="relative bg-white rounded-xl shadow-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpenModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RxCross2 className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-800 mb-6">Download Reports</h2>

              {/* Date Pickers */}
              {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <DatePicker
                    selected={startDate}
                    onChange={setStartDate}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholderText="Select start date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <DatePicker
                    selected={endDate}
                    onChange={setEndDate}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholderText="Select end date"
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
              </div> */}

              {/* Report Buttons */}
              <div className=" grid grid-cols-2 gap-4">
                <ExpenseLimitReport/>
                
                {/* <button className="w-full flex items-center justify-center gap-2 text-sm p-3 rounded-md text-white bg-green-500 hover:bg-green-600 transition-colors">
                  <FaFileDownload /> Expense Report
                </button>
                <button className="w-full flex items-center justify-center gap-2 text-sm p-3 rounded-md text-white bg-purple-500 hover:bg-purple-600 transition-colors">
                  <FaFileDownload /> Budget  Report
                </button>
                <button className="w-full flex items-center justify-center gap-2 text-sm p-3 rounded-md text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                  <FaFileDownload /> Department Report
                </button> */}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}