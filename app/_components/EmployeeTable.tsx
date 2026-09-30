import React, { useState } from "react";
import { RiCloseLine } from "react-icons/ri";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import RowData2Pdf from "./RowData2Pdf";

type EmployeeTableProps = {
  rowData: any;
  onClose: () => void;
};

const EmployeeTable: React.FC<EmployeeTableProps> = ({ onClose, rowData }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isImage, setIsImage] = useState<boolean>(false);

  const handleFileClick = (url: string) => {
    setSelectedFile(url);
    setIsImage(/\.(jpeg|jpg|gif|png|webp)$/i.test(url));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const expenseCategories = [
    { key: "convenance1", label: "Convenance 1" },
    { key: "convenance2", label: "Convenance 2" },
    { key: "purchase1", label: "Purchase 1" },
    { key: "purchase2", label: "Purchase 2" },
    { key: "food", label: "Food" },
    { key: "foodWithStaff", label: "Food with Staff" },
    { key: "tea", label: "Tea" },
    { key: "labour", label: "Labour" },
    { key: "hotel", label: "Hotel" },
    { key: "courier", label: "Courier" },
    { key: "loading", label: "Loading" },
    { key: "unloading", label: "Un-Loading" },
    { key: "porter", label: "Porter" },
    { key: "cartage", label: "Cartage" },
    { key: "rider", label: "Rider" },
    { key: "dailyWages", label: "Daily Wages" },
    { key: "transport", label: "Transport" },
    { key: "maintenance", label: "Maintenance" },
    { key: "other1", label: "Other1" },
    { key: "other2", label: "Other2" },
    { key: "miscellaneous1", label: "Miscellaneous1" },
    { key: "miscellaneous2", label: "Miscellaneous2" },
  ];

  const totalAmount = expenseCategories.reduce((sum, category) => {
    const items = rowData[category.key] || [];
    return (
      sum +
      items.reduce((acc: number, item: any) => acc + (item.amount || 0), 0)
    );
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-violet-100">
          <div>
            <h3 className="text-2xl font-bold text-violet-800">
              Expense Details
            </h3>
            <p className="text-sm mt-1">{formatDate(rowData.date)}</p>
          </div>
          <RowData2Pdf rowData={rowData} />

          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={onClose}
            className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg"
          >
            <RiCloseLine className="text-2xl" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {expenseCategories.map((category) => (
            <div key={category.key} className="mb-8 last:mb-0">
              {(rowData[category.key]?.length ?? 0) > 0 && (
                <>
                  <h4 className="text-lg font-semibold text-violet-700 mb-4">
                    {category.label}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rowData[category.key]?.map((item: any, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-50 p-4 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-medium ">
                              Site Name:{" "}
                              <span className="text-gray-600">
                                {item.siteName}
                              </span>
                            </p>
                            <p className="text-sm ">
                              Work:{" "}
                              <span className="text-gray-600">
                                {item.todayWork}
                              </span>
                            </p>
                          </div>
                          <span className="text-lg font-bold ">
                            Amount:{" "}
                            <span className="text-violet-700">
                              ₹{item.amount?.toLocaleString("en-IN")}
                            </span>
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-sm  mb-3">
                            Description:{" "}
                            <span className="text-gray-600">
                              {item.description}
                            </span>{" "}
                          </p>
                        )}

                        {(item.locationFiles?.length > 0 ||
                          item.paymentFiles?.length > 0 ||
                          item.invoiceFiles?.length > 0) && (
                          <div className="border-t pt-3 mt-3">
                            <p className="text-xs text-gray-500 mb-2">
                              Attachments:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ...(item.locationFiles || []),
                                ...(item.paymentFiles || []),
                                ...(item.invoiceFiles || []),
                              ].map((file, fileIndex) => (
                                <motion.div
                                  key={fileIndex}
                                  whileHover={{ scale: 1.05 }}
                                  className="cursor-pointer relative w-16 h-16 rounded overflow-hidden border border-gray-200"
                                  onClick={() => handleFileClick(file)}
                                >
                                  <Image
                                    src={file}
                                    alt="Document"
                                    fill
                                    className="object-cover"
                                  />
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-violet-100 p-4 bg-violet-50">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-violet-700">Total Amount:</span>
            <span className="text-xl font-bold text-violet-800">
              ₹{totalAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* File view Modal */}
        <AnimatePresence>
          {selectedFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 m-4"
              >
                <div className="max-h-[80vh] overflow-auto flex items-center justify-center">
                  {isImage ? (
                    <Image
                      src={selectedFile}
                      alt="Preview"
                      width={800}
                      height={600}
                      className="rounded-lg object-contain max-w-full max-h-[70vh] shadow-md"
                    />
                  ) : (
                    <iframe
                      src={selectedFile}
                      className="w-full h-[70vh] rounded-lg border shadow-md"
                      title="Document Preview"
                    />
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setSelectedFile(null)}
                  className="absolute -top-4 -right-4 bg-red-600 text-white p-2 rounded-full shadow-lg"
                >
                  <RiCloseLine className="text-xl" />
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default EmployeeTable;
