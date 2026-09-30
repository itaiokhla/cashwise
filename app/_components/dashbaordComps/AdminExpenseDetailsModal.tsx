import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaPen } from "react-icons/fa";
import AdminMessageModal from "../AdminMessageModal";
import Loader from "../Loader";
import client from "@createRequest";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";

type CloseTransactionModalProps = {
  closeModal: () => void;
  userExpenseData: any;
};

export default function AdminExpenseDetailsModal({
  closeModal,
  userExpenseData,
}: CloseTransactionModalProps) {
  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
    setValue,
  } = useForm();
  const [loading, setLoading] = React.useState<boolean>(false);
  const [messageModal, setMessageModal] = useState(false);
  const [expenseData, setExpenseData] = useState<any>();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const openMessageModal = (items: any) => {
    setExpenseData(items);
    setMessageModal(true);
  };
  const closeMessageModal = () => {
    setMessageModal(false);
  };
  // date formate function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN");
  };

  const formatFieldName = (key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (str) => str.toUpperCase());
  };

  const displayValue = (key: string, value: any) => {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return null;
    }

    if (key.toLowerCase() === "amount") {
      return `₹${Number(value).toLocaleString("en-IN")}`;
    }

    if (key.toLowerCase().includes("number") && typeof value === "number") {
      value = value.toString().replace(/[^0-9]/g, "");
      return (
        <a
          href={`tel:${value}`}
          className="text-purple-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value.toLocaleString("en-IN")}
        </a>
      );
    }

    if (
      key === "location" &&
      typeof value === "string" &&
      value.startsWith("{")
    ) {
      try {
        const loc = JSON.parse(value);
        return (
          <a
            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline"
          >
            View on Map
          </a>
        );
      } catch {
        return "Invalid location format";
      }
    }

    if (
      (key.includes("Files") || key.includes("imageUrl")) &&
      Array.isArray(value)
    ) {
      return (
        // <div className="flex flex-wrap gap-2 ">
        //   {value.map((url, i) => (
        //     <a
        //       key={i}
        //       href={url}
        //       target="_blank"
        //       rel="noopener noreferrer"
        //       className="text-purple-600 hover:underline"
        //     >
        //       {/* File {i + 1} */}
        //       <motion.img
        //                         whileHover={{ scale: 1.05 }}
        //                         whileTap={{ scale: 0.95 }}
        //                         src={url}
        //                         alt={`photo ${i + 1}`}
        //                         className="w-16 h-16 object-cover rounded-md border "
        //                       />
        //     </a>
        //   ))}
        // </div>
        null
      );
    }

    if (typeof value === "object") return JSON.stringify(value, null, 2);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString("en-IN");

    return value;
  };
  // function to handle message Modal
  const handleWriteMessage = async (writeMessage: any, expenseData: any) => {
    setValue("message", writeMessage.adminMessage);
    // setValue("status", "");
    setValue("expenseId", expenseData?._id);

    handleExpenseUpdate();
    setMessageModal(false);
  };
  // function to handle update
  const handleApproval = async (items: any, statusData: string) => {
    const result = confirm(`Confirm to ${statusData}!`);
    if (!result) return;

    setValue("status", statusData);
    setValue("expenseId", items._id);
    setValue("message", "");

    if (statusData === "approved") {
      await handleExpenseUpdate();
      router.push(`/account/transactiondetails/${userExpenseData?.userId}`);
    }
    if (statusData === "rejected") {
      openMessageModal(items);
    }
  };
  // function to handle expense update
  const handleExpenseUpdate = async () => {
    try {
      const expenseId = getValues("expenseId");
      const status = getValues("status");
      const message = getValues("message");
      // setLoading(true);
      const formData = new FormData();
      formData.append("status", status);
      formData.append("message", message);
      formData.append("formType", userExpenseData.formType);
      formData.append("date", userExpenseData.date);
      formData.append("userId", userExpenseData.userId);
      formData.append("phone", userExpenseData.phone);
      formData.append("expenseType", userExpenseData.expenseType);
      formData.append("expenseId", expenseId);
      const response = await client.put("/users/expenses", formData);
      if (response.status === 200) {
        return toast.success("Expense Updated Successfully");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(
        (error as any)?.response?.data?.message || "Something went wrong!"
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 `}
      onClick={(e) => {
        e.stopPropagation(), closeModal();
      }}
    >
      {loading && <Loader />}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeModal();
            }}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2"
          >
            <FaArrowLeft size={20} /> Go Back
          </button>
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent capitalize">
              {userExpenseData.expenseType} Details{" "}
              <span className="text-gray-400 text-sm">
                [{userExpenseData.name}]
              </span>
              <br />
              <span className="text-sm text-gray-500 font-normal flex items-center gap-2">
                <strong>
                  From :{" "}
                  {userExpenseData?.fromDate
                    ? formatDate(userExpenseData.fromDate)
                    : ""}
                </strong>
                <strong>
                  {" "}
                  To :{" "}
                  {userExpenseData?.toDate
                    ? formatDate(userExpenseData.toDate)
                    : ""}
                </strong>
              </span>
            </h2>
            <button
              onClick={(e) => {
                e.stopPropagation(), closeModal();
              }}
              className="text-gray-500 hover:text-gray-700 text-3xl"
            >
              &times;
            </button>
          </div>

          <div className="space-y-6">
            {userExpenseData?.categoryData &&
              userExpenseData?.categoryData?.map(
                (items: any, index: number) => (
                  <div
                    key={items._id || index}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex flex-col mb-4 text-sm">
                      <h3 className="font-semibold mb-4 text-lg">
                        Item {index + 1}
                      </h3>
                      {/* { user && (user.role==='admin' || user.role==='manager') && (
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className=" cursor-pointer bg-green-500 hover:bg-green-600 rounded-lg p-2 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation(),
                            handleApproval(items, "approved");
                        }}
                      >
                        Approve
                      </span>
                      <span
                        className="cursor-pointer bg-red-500 hover:bg-red-600 rounded-lg p-2 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation(),
                            handleApproval(items, "rejected");
                        }}
                      >
                        Reject
                      </span>
                      <motion.span
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openMessageModal(items);
                        }}
                        className="p-2 bg-purple-500 rounded-lg text-white cursor-pointer"
                      >
                        Admin Message
                      </motion.span>
                    </div>
                    )} */}
                    </div>
                    <div className="space-y-4">
                      <div className="border p-4 rounded-md space-y-2">
                        {items?.siteName && (
                          <p>
                            <strong>Site Name:</strong>{" "}
                            {items.siteName ? items.siteName : "N/A"}
                          </p>
                        )}

                        {items?.todayWork && (
                          <p>
                            <strong>Today&apos;s Work:</strong>{" "}
                            {items.todayWork ? items.todayWork : "N/A"}
                          </p>
                        )}
                        {items?.description && (
                          <p>
                            <strong>Description:</strong> {items.description}
                          </p>
                        )}
                        {items?.remarks && (
                          <p>
                            <strong>Remarks:</strong> {items.remarks}
                          </p>
                        )}
                        {items?.location && (
                          <p>
                            <strong>Location:</strong>{" "}
                            {items.location ? (
                              <a
                                onClick={(e) => e.stopPropagation()}
                                href={`https://www.google.com/maps?q=${items.location?.latitude},${items.location?.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:underline"
                              >
                                View on Map
                              </a>
                            ) : (
                              "N/A"
                            )}
                          </p>
                        )}
                        <p>
                          <strong>Amount:</strong>{" "}
                          <span className="text-purple-500">
                            {" "}
                            ₹{items.amount}
                          </span>
                        </p>
                        {items?.adminMessage && (
                          <p>
                            <strong>Admin Remarks:</strong>{" "}
                            <span className="text-purple-500">
                              {" "}
                              {items.adminMessage ? items.adminMessage : "N/A"}
                            </span>
                          </p>
                        )}
                        <p className="capitalize">
                          <strong>Status: </strong>
                          <span
                            className={`p-1 rounded-lg shadow-sm 
  ${
    items.status === "approved"
      ? "text-green-500"
      : items.status === "rejected"
      ? "text-red-700"
      : items.status === "pending"
      ? "text-yellow-500"
      : ""
  }`}
                          >
                            {items.status ? items.status : "N/A"}
                          </span>{" "}
                        </p>

                        <div className="pt-2">
                          <p className="font-semibold">Additional Details:</p>
                          {Object.entries(items).map(([key, value]) => {
                            if (
                              [
                                "_id",
                                "__v",
                                "siteName",
                                "todayWork",
                                "serviceProvider",
                                "description",
                                "remarks",
                                "amount",
                                "location",
                                "locationFiles",
                                "status",
                                "adminMessage",
                              ].includes(key)
                            )
                              return null;
                            const formattedKey = formatFieldName(key);
                            const formattedValue = displayValue(key, value);
                            return (
                              formattedValue && (
                                <div
                                  key={key}
                                  className="flex justify-between items-start"
                                >
                                  <span className="font-medium text-gray-700">
                                    {formattedKey}:
                                  </span>
                                  <span className="text-right max-w-[60%] break-words">
                                    {formattedValue}
                                  </span>
                                </div>
                              )
                            );
                          })}
                        </div>
                        {/* Displaying payment files as images */}
                        {items.paymentFiles?.length > 0 && (
                          <div className="pt-2">
                            <p className="font-semibold">Payment Photos:</p>
                            <div className="flex flex-wrap gap-2">
                              {items.paymentFiles.map(
                                (url: string, i: number) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline"
                                  >
                                    <motion.img
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      src={url}
                                      alt={`photo ${i + 1}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className="w-16 h-16 object-cover rounded-md border border-gray-400"
                                    />
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {/* Displaying location files as images */}
                        {items.locationFiles?.length > 0 && (
                          <div className="pt-2">
                            <p className="font-semibold">Location Photos:</p>
                            <div className="flex flex-wrap gap-2">
                              {items.locationFiles.map(
                                (url: string, i: number) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline"
                                  >
                                    <motion.img
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      src={url}
                                      alt={`photo ${i + 1}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className="w-16 h-16 object-cover rounded-md border border-gray-400"
                                    />
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {/* Displaying invoice files as images */}
                        {items.invoiceFiles?.length > 0 && (
                          <div className="pt-2">
                            <p className="font-semibold">Location Photos:</p>
                            <div className="flex flex-wrap gap-2">
                              {items.invoiceFiles.map(
                                (url: string, i: number) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-600 hover:underline"
                                  >
                                    <motion.img
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      src={url}
                                      alt={`photo ${i + 1}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className="w-16 h-16 object-cover rounded-md border border-gray-400"
                                    />
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
          </div>
        </div>
      </motion.div>
      {messageModal && (
        <AdminMessageModal
          onWriteMessage={handleWriteMessage}
          expenseData={expenseData}
          closeModal={closeMessageModal}
        />
      )}
    </div>
  );
}
