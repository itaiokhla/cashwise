import React from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface FilterFormValues {
  name: string;
  fromDate: Date | null;
  toDate: Date | null;
  minAmount: number;
  maxAmount: number;
  reason: string;
  transactionType: string;
}

interface FilterProps {
  onApplyTransactionDetailsFilters: (data: FilterFormValues) => void;
}
const animationVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Animation variants for form fields
const fieldVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20,
    },
  },
};

export default function TransactionFilterModal({
  onApplyTransactionDetailsFilters,
}: FilterProps) {
  const { register, handleSubmit, reset, control, setValue } =
    useForm<FilterFormValues>({
      defaultValues: {
        name: "",
        fromDate: null,
        toDate: null,
        minAmount: 0,
        maxAmount: 0,
        reason: "",
        transactionType: "all",
      },
    });
  const [isOpen, setIsOpen] = React.useState(false);

  const onSubmit: SubmitHandler<FilterFormValues> = (data) => {


    onApplyTransactionDetailsFilters(data);
    setIsOpen(false);
    reset();
  };
  const setRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    if (days === 1) {
      setValue("fromDate", from);
      setValue("toDate", from);
    } else {
      setValue("fromDate", from);
      setValue("toDate", to);
    }
  };

  const setQuarterRange = (start: Date, end: Date) => {
    setValue("fromDate", start);
    setValue("toDate", end);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <strong className="p-2 shadow-md rounded-md text-white bg-gradient-to-r from-purple-500 to-purple-500">
          Filters 
        </strong>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 "
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-gray-200 rounded-xl shadow-2xl p-6  max-w-sm mx-4  max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent">
                  Transaction Filters
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors text-2xl"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <AnimatePresence>
                  {/* transaction type Dropdown */}
                  <motion.div
                    variants={animationVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction Type
                    </label>
                    <select
                      {...register("transactionType")}
                      className="w-full bg-gray-300 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                    >
                      <option value="all">All</option>
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                      <option value="officeExpense">Office Expense</option>
                      <option value="travelExpense">Travel Expense</option>
                      <option value="toPayExpense">To Pay Expense</option>
                      <option value="allExpense">All Expense</option>
                    </select>
                  </motion.div>
                  {/* Name Field */}
                  <motion.div
                    variants={animationVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      {...register("name")}
                      className="w-full bg-gray-300 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                    />
                  </motion.div>

                  {/* Quick Range Buttons */}
                  <motion.div
                    variants={fieldVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <p className="text-sm font-medium text-purple-900">
                      Quick Range
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 0, 7, 30].map((days) => (
                        <motion.button
                          key={days}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setRange(days)}
                          className="px-3 py-1.5 text-sm rounded-full bg-gradient-to-r from-purple-50 to-purple-50 border border-purple-200 hover:border-purple-400 text-purple-700 transition-all"
                        >
                          {days === 1
                            ? "Yesterday"
                            : days === 0
                            ? "Today"
                            : days === 7
                            ? "1 Week"
                            : "1 Month"}
                        </motion.button>
                      ))}
                    </div>
                    <motion.div
                      variants={fieldVariants}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.3 }}
                      className="space-y-2"
                    >
                      <div className="flex gap-2 flex-wrap">
                        {[
                          {
                            label: "Jan-Mar",
                            start: new Date(new Date().getFullYear(), 0, 1),
                            end: new Date(new Date().getFullYear(), 2, 31),
                          },
                          {
                            label: "Apr-Jun",
                            start: new Date(new Date().getFullYear(), 3, 1),
                            end: new Date(new Date().getFullYear(), 5, 30),
                          },
                          {
                            label: "Jul-Sept",
                            start: new Date(new Date().getFullYear(), 6, 1),
                            end: new Date(new Date().getFullYear(), 8, 30),
                          },
                          {
                            label: "Oct-Dec",
                            start: new Date(new Date().getFullYear(), 9, 1),
                            end: new Date(new Date().getFullYear(), 11, 31),
                          },
                        ].map((quarter) => (
                          <motion.button
                            key={quarter.label}
                            type="button"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              setQuarterRange(quarter.start, quarter.end)
                            }
                            className="px-3 py-1.5 text-sm rounded-full bg-gradient-to-r from-purple-50 to-purple-50 border border-purple-200 hover:border-purple-400 text-purple-700 transition-all"
                          >
                            {quarter.label}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                  {/* Date Range */}
                  <motion.div
                    variants={animationVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Date
                      </label>
                      <Controller
                        control={control}
                        name="fromDate"
                        render={({ field }) => (
                          <DatePicker
                            selected={field.value}
                            dateFormat={"dd/MM/yyyy"}
                            onChange={(date) => field.onChange(date)}
                            className="w-full px-4 bg-gray-300 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                            placeholderText="Select start date"
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To Date
                      </label>
                      <Controller
                        control={control}
                        name="toDate"
                        render={({ field }) => (
                          <DatePicker
                            selected={field.value}
                            dateFormat={"dd/MM/yyyy"}
                            onChange={(date) => field.onChange(date)}
                            className="w-full px-4 bg-gray-300 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                            placeholderText="Select end date"
                          />
                        )}
                      />
                    </div>
                  </motion.div>

                  {/* Amount Range */}
                  <motion.div
                    variants={animationVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Amount
                      </label>
                      <input
                        type="number"
                        {...register("minAmount")}
                        className="w-full px-4 bg-gray-300 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Amount
                      </label>
                      <input
                        type="number"
                        {...register("maxAmount")}
                        className="w-full px-4 bg-gray-300 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                      />
                    </div>
                  </motion.div>

                  {/* Reason Dropdown */}
                  {/* <motion.div
                    variants={animationVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason
                    </label>
                    <select
                      {...register("reason")}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm transition-all"
                    >
                      <option value="">All Reasons</option>
                      <option value="payment">Payment</option>
                      <option value="refund">Refund</option>
                      <option value="transfer">Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </motion.div> */}
                </AnimatePresence>

                {/* Action Buttons */}
                <motion.div
                  className="flex justify-end gap-3 mt-6"
                  variants={animationVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setIsOpen(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-600 text-white hover:opacity-90 transition-opacity shadow-md"
                  >
                    Apply Filters
                  </button>
                </motion.div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
