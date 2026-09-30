import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaPen, FaCalendarAlt, FaUser, FaArrowLeft } from "react-icons/fa";
import AdminMessageModal from "../AdminMessageModal";
import Loader from "../Loader";
import client from "@createRequest";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import { clearArrayFiles, selectFiles } from "@redux/files/filesSlice";
import {
  useAdminActionExpenseMutation,
  useUploadNewFilesMutation,
} from "@app/_api_query/group.api";
import AntdFileUpload from "../AntdUpload";
import { useAppDispatch } from "../../../redux/redux.hooks";
import CalendarDateFilter from "./CalendarDateFilter";

type CloseTransactionModalProps = {
  closeModal: () => void;
  accountData: any;
};

const displayFields = [
  "cartage",
  "conveyance",
  "courier",
  "dailyWages",
  "food",
  "hotel",
  "labour",
  "loading",
  "maintenance",
  "other",
  "porter",
  "purchase",
  "rider",
  "tea",
  "transport",
];

export default function AdminAccountDetailsModal({
  closeModal,
  accountData,
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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [uploadNewFile] = useUploadNewFilesMutation();
  const [adminAction, { isLoading }] = useAdminActionExpenseMutation();
  const [uploadFile, setUploadFile] = useState(null);
  const [openSiteModal, setOpenSiteModal] = useState(false);
  const [siteValue, setSiteValue] = useState("");
  const [currentExpenseDetail, setCurrentExpenseDetail] = useState<any>(null);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user: any = useAppSelector(selectUser);
  const files = useAppSelector(selectFiles);

  const openMessageModal = ({
    formType,
    documentId,
    fieldType,
    fieldsId,
    date,
    userId,
    phone,
  }: any) => {
    setExpenseData({
      formType,
      documentId,
      fieldType,
      fieldsId,
      date,
      userId,
      phone,
    });
    setMessageModal(true);
  };

  const closeMessageModal = () => {
    setMessageModal(false);
  };

  // Date format function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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
      const phoneStr = value.toString().replace(/[^0-9]/g, "");
      return (
        <a
          href={`tel:${phoneStr}`}
          className="text-purple-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {phoneStr}
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
            onClick={(e) => e.stopPropagation()}
          >
            📍 View on Map
          </a>
        );
      } catch {
        return "Invalid location format";
      }
    }

    if (typeof value === "object") return JSON.stringify(value, null, 2);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString("en-IN");

    return value;
  };

  // Function to handle message Modal
  const handleWriteMessage = async (writeMessage: any, expenseData: any) => {
    setValue("message", writeMessage.adminMessage);
    setValue("expenseId", expenseData?._id);
    handleExpenseUpdate({
      documentId: expenseData.documentId,
      fieldType: expenseData.fieldType,
      fieldsId: expenseData.fieldsId,
      date: expenseData.date,
      userId: expenseData.userId,
      phone: expenseData.phone,
      status: expenseData.status,
    });
    setMessageModal(false);
  };

  // Function to handle approval
  const handleApproval = async ({
    documentId,
    fieldType,
    fieldsId,
    date,
    userId,
    phone,
    status,
  }: any) => {
    const result = confirm(`Confirm to ${status}!`);
    if (!result) return;

    setValue("status", status);
    setValue("expenseId", fieldsId);
    setValue("message", "");

    if (status === "approved") {
      await handleExpenseUpdate({
        documentId,
        fieldType,
        fieldsId,
        date,
        userId,
        phone,
        status,
      });
      //   router.push(`/account/transactiondetails/${accountData?.userId}`);
    }
    if (status === "rejected") {
      openMessageModal({
        formType: accountData?.expenseType,
        documentId,
        fieldType,
        fieldsId,
        date,
        userId,
        phone,
      });
    }
  };

  // Function to handle expense update
  const handleExpenseUpdate = async ({
    documentId,
    fieldType,
    fieldsId,
    date,
    userId,
    phone,
    status,
  }: any) => {
    try {
      const expenseId = getValues("fieldsId");
      const status = getValues("status");
      const message = getValues("message");

      setLoading(true);
      const formData = new FormData();
      formData.append("status", status);
      formData.append("message", message);
      formData.append("formType", accountData.expenseType);
      formData.append("date", date || new Date().toISOString().split("T")[0]);
      formData.append("userId", userId);
      formData.append("phone", phone);
      formData.append("expenseType", fieldType);
      formData.append("expenseId", fieldsId);

      const response = await adminAction(formData).unwrap();
      if (response.type === "SUCCESS") {
        toast.success("Expense Updated Successfully");
        closeMessageModal();
      }
    } catch (error) {
      console.error("Error updating expense:", error);
      toast.error(
        (error as any)?.response?.data?.message || "Something went wrong!"
      );
    } finally {
      setLoading(false);
    }
  };

  // Get unique dates for filter
  const uniqueDates = accountData?.expenseDetails
    ? Array.from(
      new Set(accountData.expenseDetails.map((detail: any) => detail.date))
    )
      .sort()
      .reverse()
    : [];

  // Filter expense details by selected date
  const filteredExpenseDetails = selectedDate
    ? accountData?.expenseDetails?.filter(
      (detail: any) => detail.date === selectedDate
    )
    : accountData?.expenseDetails || [];

  // Calculate total amount for filtered data
  const calculateTotalAmount = (expenseDetails: any[]) => {
    return expenseDetails.reduce((total, detail) => {
      return (
        total +
        displayFields.reduce((dayTotal, field) => {
          const items = detail[field] || [];
          return (
            dayTotal +
            items.reduce(
              (fieldTotal: number, item: any) =>
                fieldTotal + (Number(item.amount) || 0),
              0
            )
          );
        }, 0)
      );
    }, 0);
  };

  const handleNewFormSubmit = async ({
    documentId,
    fieldType,
    fieldsId,
  }: any) => {
    try {
      const response = await uploadNewFile({
        schemaType: accountData?.expenseType,
        documentId,
        expenseType: fieldType,
        filedId: fieldsId,
        files,
      }).unwrap();
      if (response.type === "SUCCESS") {
        toast.success(response.message);
        setUploadFile(null);
        dispatch(clearArrayFiles());
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error?.data?.message);
    }
  };

  async function handleSiteNameChange(siteValue: string) {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("siteName", siteValue);
      formData.append("formType", accountData.expenseType);
      formData.append("expenseType", currentExpenseDetail?.field);
      formData.append("documentId", currentExpenseDetail?.expenseDetail?._id);
      formData.append("expenseId", currentExpenseDetail?.itemId);
      formData.append(
        "userId",
        currentExpenseDetail?.expenseDetail?.createdBy?._id
      );
      formData.append("date", currentExpenseDetail?.expenseDetail?.date);
      const response = await adminAction(formData).unwrap();
      if (response.type === "SUCCESS") {
        toast.success("Site name updated successfully");
        closeSiteModal();
      }
    } catch (error) {
      toast.error(
        (error as any)?.response?.data?.message || "Failed to update site name"
      );
    } finally {
      setLoading(false);
    }
  }

  const closeSiteModal = () => {
    setOpenSiteModal(false);
    setSiteValue("");
    dispatch(clearArrayFiles());
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={(e) => {
        e.stopPropagation();
        closeModal();
      }}
    >
      {loading && <Loader />}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          e.stopPropagation(), dispatch(clearArrayFiles());
        }}
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
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent capitalize">
                {accountData?.expenseType || "Office"} Expense Details{" "}
                <span className="text-sm text-gray-600">
                  {" "}
                  [{accountData?.expenseDetails[0]?.createdBy?.name || "User"}]
                </span>
              </h2>
              <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <FaCalendarAlt className="text-purple-500" />
                  Total Records: {accountData?.expenseDetails?.length || 0}
                </span>
                <span className="flex items-center gap-1">
                  💰 Total Amount: ₹
                  {calculateTotalAmount(filteredExpenseDetails).toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
              className="text-gray-500 hover:text-gray-700 text-3xl font-light"
            >
              ×
            </button>
          </div>

          {/* Date Filter */}
          {/* <div className="mb-6">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-medium text-gray-700">Filter by Date:</span>
              <button
                onClick={() => setSelectedDate("")}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedDate === ""
                    ? "bg-purple-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                All Dates ({accountData?.expenseDetails?.length || 0})
              </button>
              {uniqueDates.map((date: any) => {
                const dayCount = accountData?.expenseDetails?.filter(
                  (d: any) => d.date === date
                ).length;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedDate === date
                        ? "bg-purple-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {formatDate(date)} ({dayCount})
                  </button>
                );
              })}
            </div>
          </div> */}
          <CalendarDateFilter
            uniqueDates={uniqueDates}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            totalRecords={accountData?.expenseDetails?.length || 0}
            accountData={accountData}
          />

          {/* Content */}
          <div className="space-y-8 max-h-[80vh] overflow-y-auto">
            {filteredExpenseDetails.map(
              (expenseDetail: any, detailIndex: number) => {
                const createdBy = expenseDetail?.createdBy?.name || "N/A";
                const expenseDate =
                  expenseDetail?.date || expenseDetail?.createdAt;

                // Check if this expense detail has any items
                const hasItems = displayFields.some(
                  (field) =>
                    Array.isArray(expenseDetail[field]) &&
                    expenseDetail[field].length > 0
                );

                if (!hasItems) return null;

                return (
                  <motion.div
                    key={expenseDetail._id || detailIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: detailIndex * 0.1 }}
                    className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    {/* Date Header */}
                    <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3">
                        <FaCalendarAlt className="text-purple-500" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">
                            {formatDate(expenseDate)}
                          </h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <FaUser className="text-green-500" />
                            Created by: {createdBy}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Day Total</p>
                        <p className="text-lg font-semibold text-green-600">
                          ₹
                          {displayFields
                            .reduce((total, field) => {
                              const items = expenseDetail[field] || [];
                              return (
                                total +
                                items.reduce(
                                  (sum: number, item: any) =>
                                    sum + (Number(item.amount) || 0),
                                  0
                                )
                              );
                            }, 0)
                            .toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    {/* Fields for this date */}
                    <div className="space-y-6">
                      {displayFields.map((field) => {
                        const items = expenseDetail[field];
                        if (!Array.isArray(items) || items.length === 0)
                          return null;

                        return (
                          <div
                            key={field}
                            className="bg-white rounded-lg p-4 shadow-sm"
                          >
                            <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center justify-between">
                              <span>
                                {formatFieldName(field)} ({items.length} item
                                {items.length > 1 ? "s" : ""})
                              </span>
                            </h4>

                            <div className="grid gap-4 ">
                              {items.map((item: any, index: number) => (
                                <motion.div
                                  key={item._id || index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 px-2 text-wrap"
                                >
                                  <span className="text-sm font-normal bg-purple-100 text-purple-800 px-2 py-1 rounded-full mb-4">
                                    {index + 1} of {items.length}{" "}
                                    <span className="lowercase">
                                      {formatFieldName(field)}{" "}
                                    </span>{" "}
                                    item{items.length > 1 ? "s" : ""}
                                  </span>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                    {/* Basic Information */}
                                    <div className="space-y-2">
                                      {item.siteName && (
                                        <div
                                          className="flex items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenSiteModal(true);
                                            setCurrentExpenseDetail({
                                              expenseDetail,
                                              field,
                                              itemId: item?._id,
                                            });
                                          }}
                                        >
                                          <span className="font-medium text-gray-700">
                                            Site:
                                          </span>
                                          <span className="ml-2 text-gray-900 flex items-center gap-1">
                                            {item.siteName}
                                            <FaPen className="text-purple-500" />
                                          </span>
                                        </div>
                                      )}
                                      {item.todayWork && (
                                        <div>
                                          <span className="font-medium text-gray-700">
                                            Work:
                                          </span>
                                          <span className="ml-2 text-gray-900">
                                            {item.todayWork}
                                          </span>
                                        </div>
                                      )}
                                      {item.description && (
                                        <div>
                                          <span className="font-medium text-gray-700">
                                            Description:
                                          </span>
                                          <span className="ml-2 text-gray-900">
                                            {item.description}
                                          </span>
                                        </div>
                                      )}
                                      {item.remarks && (
                                        <div>
                                          <span className="font-medium text-gray-700">
                                            Remarks:
                                          </span>
                                          <span className="ml-2 text-gray-900">
                                            {item.remarks}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Amount and Status */}
                                    <div className="space-y-2">
                                      <div>
                                        <span className="font-medium text-gray-700">
                                          Amount:
                                        </span>
                                        <span className="ml-2 text-xl font-bold text-green-600">
                                          ₹
                                          {Number(
                                            item.amount || 0
                                          ).toLocaleString("en-IN")}
                                        </span>
                                      </div>
                                      {item.status && (
                                        <div>
                                          <span className="font-medium text-gray-700">
                                            Status:
                                          </span>
                                          <span
                                            className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${item.status === "approved"
                                                ? "bg-green-100 text-green-800"
                                                : item.status === "rejected"
                                                  ? "bg-red-100 text-red-800"
                                                  : "bg-yellow-100 text-yellow-800"
                                              }`}
                                          >
                                            {item.status
                                              .charAt(0)
                                              .toUpperCase() +
                                              item.status.slice(1)}
                                          </span>
                                        </div>
                                      )}
                                      {item?.adminMessage && (
                                        <p>
                                          <span className="font-medium text-gray-700">
                                            Admin Remarks:
                                          </span>{" "}
                                          <span className="text-purple-500 capitalize">
                                            {" "}
                                            {item?.adminMessage
                                              ? item?.adminMessage
                                              : "N/A"}
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Additional Details */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm mb-4 px-2">
                                    {Object.entries(item).map(
                                      ([key, value]) => {
                                        if (
                                          [
                                            "_id",
                                            "__v",
                                            "siteName",
                                            "todayWork",
                                            "description",
                                            "remarks",
                                            "amount",
                                            "status",
                                            "locationFiles",
                                            "paymentFiles",
                                            "invoiceFiles",
                                            "adminMessage",
                                            "location",
                                          ].includes(key)
                                        )
                                          return null;

                                        const formattedValue = displayValue(
                                          key,
                                          value
                                        );
                                        if (!formattedValue) return null;

                                        return (
                                          <div
                                            key={key}
                                            className="flex justify-between items-start"
                                          >
                                            <span className="font-medium text-gray-600 capitalize">
                                              {formatFieldName(key)}:
                                            </span>
                                            <span className="text-gray-900 text-right max-w-[60%] break-words">
                                              {formattedValue}
                                            </span>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>

                                  {/* Location */}
                                  {item.location && (
                                    <div className="mb-4 p-2 bg-purple-50 rounded">
                                      <span className="font-medium text-gray-700">
                                        Location:
                                      </span>
                                      {displayValue("location", item.location)}
                                    </div>
                                  )}

                                  {/* Images */}
                                  <div className="space-y-3">
                                    {/* Payment Files */}
                                    {item.paymentFiles?.length > 0 && (
                                      <div>
                                        <p className="font-medium text-gray-700 mb-2">
                                          💳 Payment Photos:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {item.paymentFiles.map(
                                            (url: string, i: number) => (
                                              <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                <motion.img
                                                  whileHover={{ scale: 1.05 }}
                                                  whileTap={{ scale: 0.95 }}
                                                  src={url}
                                                  alt={`Payment ${i + 1}`}
                                                  className="w-20 h-20 object-cover rounded-md border-2 border-green-300 hover:border-green-500 cursor-pointer"
                                                />
                                              </a>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Invoice Files */}
                                    {item.invoiceFiles?.length > 0 && (
                                      <div>
                                        <p className="font-medium text-gray-700 mb-2">
                                          🧾 Invoice Photos:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {item.invoiceFiles.map(
                                            (url: string, i: number) => (
                                              <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                <motion.img
                                                  whileHover={{ scale: 1.05 }}
                                                  whileTap={{ scale: 0.95 }}
                                                  src={url}
                                                  alt={`Invoice ${i + 1}`}
                                                  className="w-20 h-20 object-cover rounded-md border-2 border-purple-300 hover:border-purple-500 cursor-pointer"
                                                />
                                              </a>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Location Files */}
                                    {item.locationFiles?.length > 0 && (
                                      <div>
                                        <p className="font-medium text-gray-700 mb-2">
                                          📍 Location Photos:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {item.locationFiles.map(
                                            (url: string, i: number) => (
                                              <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                <motion.img
                                                  whileHover={{ scale: 1.05 }}
                                                  whileTap={{ scale: 0.95 }}
                                                  src={url}
                                                  alt={`Location ${i + 1}`}
                                                  className="w-20 h-20 object-cover rounded-md border-2 border-purple-300 hover:border-purple-500 cursor-pointer"
                                                />
                                              </a>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-4 flex justify-between items-center">
                                    {uploadFile !== item?._id && (
                                      <button
                                        className="p-2 rounded-md shadow-sm text-white bg-purple-500 float-end text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation(),
                                            setUploadFile(item?._id),
                                            dispatch(clearArrayFiles());
                                        }}
                                      >
                                        Upload new file
                                      </button>
                                    )}

                                    {uploadFile === item?._id && (
                                      <div>
                                        <AntdFileUpload
                                          category={[
                                            "Location",
                                            "Payment",
                                            "Invoice",
                                          ]}
                                        />

                                        <button
                                          className="p-2 rounded-md shadow-sm text-white bg-purple-500 float-end text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation(),
                                              handleNewFormSubmit({
                                                documentId: expenseDetail._id,
                                                fieldType: field,
                                                fieldsId: item._id,
                                              });
                                          }}
                                        >
                                          Submit
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {/* Action Buttons */}
                                  {/* <div className="mt-4 pt-4 border-t flex  gap-2 "> */}

                                    {/* Action Buttons */}
{/* {!item.tallyEntry && (
  <button
    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
    onClick={async (e) => {
      e.stopPropagation();
      if (confirm("Are you sure you want to create a voucher for this expense?")) {
        try {
          // Show loading state
          toast.info("Creating voucher...");

          const formData = new FormData();
          formData.append("ledgerType", item.ledgerType || "Sundry Creditors");
          formData.append("expenseType", field);
          formData.append("amount", item.amount.toString());
          formData.append("narration", item.description || item.remarks || `Expense for ${field}`);
          formData.append("date", expenseDetail.date);
          formData.append("toName", expenseDetail.createdBy?.name || "User");
          formData.append("fromName", user?.name || "Admin");
          formData.append("toPhone", expenseDetail.createdBy?.phone || "");
          formData.append("fromPhone", user?.phone || "");
          formData.append("reason", item.description || field);
          formData.append("remarks", item.remarks || "");
          
          // Payment voucher specific fields (safe defaults)
          formData.append("cashBankName", "Cash");
          formData.append("cashBankGroupName", "Cash-in-Hand");
          formData.append("instrumentType", "Cash");

          // 🔥 CONDITIONAL: Choose API based on user ID
          const voucherApi = user?._id === "67e525f3b5239a00bf276fd3" 
            ? "/api/payment-voucher" 
            : "/api/journal-voucher";

          const response = await fetch(voucherApi, {
            method: "POST",
            body: formData,
          });

          // 🔥 CRITICAL FIX: Check response type BEFORE parsing JSON
          let result;
          const contentType = response.headers.get("content-type");
          
          if (response.ok && contentType?.includes("application/json")) {
            result = await response.json();
          } else {
            // Get raw text for debugging
            const errorText = await response.text();
            console.error("Non-JSON response received:", {
              status: response.status,
              statusText: response.statusText,
              contentType,
              errorText: errorText.substring(0, 500), // First 500 chars
            });
            throw new Error(`API error ${response.status}: ${response.statusText}`);
          }

          if (result.type === "SUCCESS" || result.success) {
            toast.success(`✅ Voucher created: ${result.result?.voucherNumber || result.voucher?.voucherNumber || "JV-XXXX"}`);
            
            // Update tallyEntry status to prevent duplicate creation
            const updateFormData = new FormData();
            updateFormData.append("tallyEntry", "Synced");
            updateFormData.append("formType", accountData.expenseType);
            updateFormData.append("expenseType", field);
            updateFormData.append("documentId", expenseDetail._id);
            updateFormData.append("expenseId", item._id);
            updateFormData.append("userId", expenseDetail.createdBy?._id);
            updateFormData.append("date", expenseDetail.date);
            
            await adminAction(updateFormData).unwrap();
            // refetch(); // Refresh data to show updated tallyEntry status
          } else {
            throw new Error(result.message || "Voucher creation failed");
          }
        } catch (error: any) {
          console.error("Voucher creation error:", error);
          toast.error(`❌ ${error.message || "Failed to create voucher. Check console for details."}`);
        }
      }
    }}
  >
  Create Voucher
  </button>
)} */}
                                    {item.status === "pending" && (
                                      <div className="flex  gap-2 justify-end">
                                        <button
                                          onClick={() =>
                                            handleApproval({
                                              documentId: expenseDetail._id,
                                              fieldType: field,
                                              fieldsId: item._id,
                                              date: expenseDate,
                                              userId:
                                                accountData?.expenseDetails[0]
                                                  ?.createdBy?._id,
                                              phone:
                                                accountData?.expenseDetails[0]
                                                  ?.createdBy?.phone,
                                              status: "approved",
                                            })
                                          }
                                          className="px-4 py-2 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-2"
                                        >
                                          ✅ Approve
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleApproval({
                                              documentId: expenseDetail._id,
                                              fieldType: field,
                                              fieldsId: item._id,
                                              date: expenseDate,
                                              userId:
                                                accountData?.expenseDetails[0]
                                                  ?.createdBy?._id,
                                              phone:
                                                accountData?.expenseDetails[0]
                                                  ?.createdBy?.phone,
                                              status: "rejected",
                                            })
                                          }
                                          className="px-4 py-2 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-2"
                                        >
                                          ❌ Reject
                                        </button>
                                        <button
                                          onClick={() =>
                                            openMessageModal({
                                              formType: accountData?.expenseType,
                                              documentId: expenseDetail._id,
                                              fieldType: field,
                                              fieldsId: item._id,
                                              date: expenseDate,
                                              userId:
                                                accountData?.expenseDetails[0]
                                                  ?.createdBy?._id,
                                              phone:
                                                accountData?.expenseDetails[0]
                                                  ?.createdBy?.phone,
                                            })
                                          }
                                          className="px-4 py-2 text-xs bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors flex items-center gap-2"
                                        >
                                          <FaPen size={12} />
                                          Message
                                        </button>
                                      </div>
                                    )}
                                  {/* </div> */}

                                </motion.div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              }
            )}
          </div>

          {filteredExpenseDetails.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">No expense data found</p>
              {selectedDate && (
                <p className="text-sm mt-2">
                  No expenses recorded for {formatDate(selectedDate)}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {messageModal && (
        <AdminMessageModal
          onWriteMessage={handleWriteMessage}
          expenseData={expenseData}
          closeModal={closeMessageModal}
        />
      )}

      {openSiteModal && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={(e) => {
              e.stopPropagation(), closeSiteModal();
              setSiteValue("");
            }}
          >
            <div
              className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2></h2>
                <button
                  className="text-gray-500 hover:text-gray-700 text-3xl"
                  onClick={(e) => {
                    e.stopPropagation(), closeSiteModal();
                    setSiteValue("");
                  }}
                >
                  &times;
                </button>
              </div>

              <form className="space-y-4">
                <div>
                  <label className="block font-medium mb-2 text-gray-700">
                    Site Name
                  </label>
                  <input
                    type="text"
                    onChange={(e) => {
                      setSiteValue(e.target.value);
                    }}
                    className="text-black bg-gray-200 border border-gray-400 rounded-md p-2"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      if (siteValue.trim() === "") {
                        toast.error("Site name cannot be empty");
                        return;
                      }
                      handleSiteNameChange(siteValue);
                      setSiteValue("");
                      closeSiteModal();
                    }}
                    className="bg-purple-500 text-white px-6 py-2 rounded-md hover:bg-purple-600 transition-colors flex items-center gap-2"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
