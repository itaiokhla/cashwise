import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IUsers } from "@app/_interface/user.interface";
import { CreditFormInterface } from "@app/_interface/credit.interface";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import { toast } from "react-toastify";
import client from "@createRequest";
import { useGetLedgersQuery } from "@app/_api_query/ledger.api";
import { useForm, Controller } from "react-hook-form";
import { IoIosArrowDown } from "react-icons/io";
import { RxCross2 } from "react-icons/rx";
type MoneyTransferProps = {
  closeModal: () => void;
  userData: IUsers;
};

export default function CreditModal({
  closeModal,
  userData,
}: MoneyTransferProps) {
  const user = useAppSelector(selectUser);
  const [loading, setLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [visibleDropdown, setVisibleDropdown] = useState<string | null>(null); // Add this line

  const {
    register,
    handleSubmit,
    reset,
    control,

    formState: { errors },
    getValues,
  } = useForm<CreditFormInterface>({
    defaultValues: {
      _id: null,
      fromName: user.name,
      fromEmail: user.email,
      fromPhone: user.phone,
      toName: userData.name,
      toEmail: userData.email,
      toPhone: userData.phone,
      ledgerType: "",
      transactionDetails: [
        {
          _id: null,
          createdAt: null,
          updatedAt: null,
          amount: null,
          files: [],
          reason: "",
          remarks: "",
          description:""
        },
      ],
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CreditFormInterface) => {
    const toName = getValues("toName");
    const toPhone = getValues("toPhone");
    if (
      user.role !== "admin" &&
      user.name === toName &&
      user.phone?.toString() === toPhone?.toString()
    ) {
      return toast.error("You can not credit self!");
    }
    try {
      setLoading(true);
      const formData = new FormData();

      // Append files
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Append other form data
      Object.entries(data).forEach(([key, value]) => {
        if (key === "transactionDetails") {
          formData.append("amount", value[0].amount?.toString() || "");
          formData.append("reason", value[0].reason || "");
          formData.append("remarks", value[0].remarks || "");
          formData.append("description", value[0].description || "");
          formData.append("ledgerType", value as string);

        } else {
          formData.append(key, value as string);
        }
      });
      const res = await client.put("/account", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.status === 201 || res.status === 200) {
        toast.success(res?.data?.message || "Money credited successfully");
        reset();
        setFiles([]);
        closeModal();
        window.location.reload();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to credit money");
    } finally {
      setLoading(false);
    }
  };
  const { data: ledgerOptions } = useGetLedgersQuery({});
console.log("ledgeroptions",ledgerOptions)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={closeModal}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="relative max-w-sm max-h-[90vh] w-full mx-4 bg-white rounded-xl shadow-2xl overflow-auto -mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-violet-700 text-3xl transition-colors"
          onClick={closeModal}
          aria-label="Close modal"
        >
          &times;
        </button>

        <div className="p-8">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent mb-2"
          >
            Credit Money
          </motion.h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Recipient Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Name
              </label>
              <input
                type="text"
                disabled
                className="w-full px-4 py-2 border border-violet-300 rounded-lg"
                {...register("toName")}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Email
              </label>
              <input
                type="email"
                disabled
                className="w-full px-4 py-2 border border-violet-300 rounded-lg"
                {...register("toEmail")}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                disabled
                className="w-full px-4 py-2 border border-violet-300 rounded-lg"
                {...register("toPhone")}
              />
            </motion.div>
            {/* Ledger Type */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">Ledger Type</label>
              <div className="relative">
                <Controller
                  name="ledgerType"
                  control={control}
                  rules={{ required: "Ledger Type is required" }}
                  render={({ field }) => (
                    <>
                      <div className="flex items-center">
                        <input
                          type="text"
                          placeholder="Select or search Ledger Type"
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            setVisibleDropdown("ledgerType");
                          }}
                          onFocus={() => setVisibleDropdown("ledgerType")}
                          className="w-full px-4 py-2 border border-violet-300 rounded-lg"
                        />
                        <span className="mt-4 -translate-x-4">
                          <IoIosArrowDown />
                        </span>
                      </div>

                      {visibleDropdown === "ledgerType" &&
                        Array.isArray(ledgerOptions?.data) &&
                        ledgerOptions.data.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white shadow-lg rounded-md max-h-60 overflow-hidden">
                            <div className="p-2 border-b flex justify-end bg-gray-200">
                              <RxCross2
                                className="text-red-400 cursor-pointer text-xl"
                                onClick={() => setVisibleDropdown(null)}
                              />
                            </div>
                            <ul className="max-h-48 overflow-auto bg-gray-200">
                              {ledgerOptions.data
                                .filter((ledger: any) =>
                                  `${ledger.ledgerName} (${ledger.groupName})`
                                    .toLowerCase()
                                    .includes(field.value.toLowerCase())
                                )
                                .map((ledger: any, index: number) => (
                                  <li
                                    key={index}
                                    onClick={() => {
                                      field.onChange(ledger.ledgerName);
                                      setVisibleDropdown(null);
                                    }}
                                    className="p-2 hover:bg-gray-300 cursor-pointer"
                                  >
                                    {ledger.ledgerName} ({ledger.groupName})
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                    </>
                  )}
                />
              </div>
              {errors.ledgerType && (
                <p className="text-red-500 text-sm">
                  {errors.ledgerType.message as string}
                </p>
              )}
            </motion.div>
            {/* Amount Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500">
                  ₹
                </span>
                <input
                  type="text"
                  required
                  min="0"
                  className="w-full pl-7 pr-4 py-2 border border-violet-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  {...register("transactionDetails.0.amount", {
                    required: "Amount Required!",
                  })}
                />
              </div>
              {errors?.transactionDetails &&
                errors.transactionDetails[0]?.amount && (
                  <span className="text-red-500">
                    {errors.transactionDetails[0].amount.message}
                  </span>
                )}
            </motion.div>

            {/* File Upload */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Upload Documents
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col w-full cursor-pointer">
                  <input
                    multiple
                    type="file"
                    accept="image/*, .pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-full px-4 py-6 border-2 border-dashed border-violet-300 rounded-lg hover:border-violet-500 transition-colors">
                    <p className="text-center text-violet-500">
                      {files.length > 0
                        ? `${files.length} files selected`
                        : "Click to upload files"}
                    </p>
                  </div>
                </label>
              </div>
              <div className="mt-2 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-100 rounded"
                  >
                    <span className="text-sm text-gray-700 truncate">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Reason Selection */}
            <label htmlFor="" className="block text-sm font-medium text-violet-700 mb-2">Reason to Credit</label>
            <motion.select
              whileHover={{ scale: 1.01 }}
              whileFocus={{ scale: 1.02 }}
              className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
              {...register("transactionDetails.0.reason", {
                required: "Reason to credit Required!",
              })}
            >
              <option value="" disabled>
                Reason to Credit
              </option>
              <option value="travel">Travel</option>
              <option value="office">Office</option>
              <option value="TOF">TOF</option>
              <option value="toPay">To Pay</option>
              {/* <option value="other">Other</option> */}
            </motion.select>
            {errors?.transactionDetails &&
              errors.transactionDetails[0]?.reason && (
                <span className="text-red-500">
                  {errors.transactionDetails[0].reason.message}
                </span>
              )}

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Remarks
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-violet-300 rounded-lg"
                {...register("transactionDetails.0.remarks",{required:"Remarks required"})}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-violet-700 mb-2">
                Description
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-violet-300 rounded-lg"
                {...register("transactionDetails.0.description",{required:"Description required!"})}
              />
            </motion.div>
            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 text-white py-2 px-4 rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:bg-gray-400"
            >
              {loading ? "Processing..." : "Submit"}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
