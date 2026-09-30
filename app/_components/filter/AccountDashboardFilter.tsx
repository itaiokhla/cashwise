"use client";
import React from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useGetUsersQuery } from "@app/_api_query/group.api";
import Select from "antd/es/select";
import type { SelectProps } from "antd/es/select";

interface FilterFormValues {
  user: string[];
  fromDate: Date | null;
  toDate: Date | null;
  expenseType: string;
  status: string;
  formType: string;
}

interface FilterProps {
  onApplyTransactionDetailsFilters: (data: FilterFormValues) => void;
  initialValues: any;
}

const fieldVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20,
    },
  },
};

export default function AccountDashboardFilterModal({
  onApplyTransactionDetailsFilters,
  initialValues,
}: FilterProps) {
    const [count, setCount] = React.useState(0);

  const today = new Date();
  const defaultFrom = new Date();

  const { register, handleSubmit, reset, control, setValue } =
    useForm<FilterFormValues>({
      defaultValues: {
        user: initialValues.user,
        fromDate: new Date(initialValues.fromDate),
        toDate: new Date(initialValues.toDate),
        expenseType: initialValues.expenseType,
        status: initialValues.status,
        formType: initialValues.formType,
      },
    });

  const [isOpen, setIsOpen] = React.useState(false);

  const onSubmit: SubmitHandler<FilterFormValues> = (data) => {
    let filterCount = 0;
    
    if (data.user && data.user.length > 0) filterCount++;
    if (data.fromDate || initialValues.fromDate) filterCount++;
    if (data.expenseType && data.expenseType !== 'all') filterCount++;
    if (data.status) filterCount++;
    if (data.formType && data.formType.length > 0) filterCount++;
    
    setCount(filterCount);

    onApplyTransactionDetailsFilters(data);
    localStorage.setItem("adminFilter", JSON.stringify(data));
    setIsOpen(false);
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

  const drawerVariants = {
    hidden: { x: "100%", opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
    exit: {
      x: "100%",
      opacity: 0,
      transition: { duration: 0.3 },
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const { data: userData } = useGetUsersQuery({});
  const usersOptions: Array<{ label: string; value: string }> = userData
    ? userData.map((user: any) => ({ label: user.name, value: user._id }))
    : [];
  const statusOptions = [
    { label: "Select status", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];
  const formOptions = [
    { label: "Cartage", value: "cartage" },
    { label: "Conveyance", value: "conveyance" },
    { label: "Courier", value: "courier" },
    { label: "Daily Wages", value: "dailyWages" },
    { label: "Food", value: "food" },
    { label: "Hotel", value: "hotel" },
    { label: "Labour", value: "labour" },
    { label: "Loading", value: "loading" },
    { label: "Maintenance", value: "maintenance" },
    { label: "Other", value: "other" },
    { label: "Porter", value: "porter" },
    { label: "Purchase", value: "purchase" },
    { label: "Rider", value: "rider" },
    { label: "Tea", value: "tea" },
    { label: "Transport", value: "transport" },
  ];
  return (
    <>
      <motion.button
        whileHover={{
          scale: 1.05,
          background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
        }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 p-2 rounded-md text-white bg-gradient-to-r from-purple-500 to-purple-500 transition-all"
        onClick={() => setIsOpen(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-semibold">Filters <span className="text-white bg-purple-600 rounded-full px-2">{count}</span></span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="fixed top-0 right-0 z-[51] h-full w-full max-w-sm bg-white shadow-2xl p-6 border-l border-purple-100 overflow-auto"
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-purple-50">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent">
                  Expense Filters
                </h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="text-purple-600 hover:text-purple-800 text-3xl transition-colors"
                >
                  &times;
                </motion.button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Expense Type */}
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1 }}
                >
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Expense Type
                  </label>
                  <select
                    {...register("expenseType")}
                    className="w-full px-4 py-3 rounded-lg border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white transition-all"
                  >
                    <option value="all">All Expenses</option>
                    <option value="office">Office Expense</option>
                    <option value="travel">Travel Expense</option>
                    <option value="toPay">To Pay Expense</option>
                  </select>
                </motion.div>

                {/* User Select */}
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Select User
                  </label>
                  <Controller
                    name="user"
                    control={control}
                    render={({ field }) => (
                      <Select
                        mode="multiple"
                        allowClear
                        style={{ width: "100%" }}
                        placeholder="Select users"
                        options={usersOptions}
                        value={field.value}
                        onChange={field.onChange}
                        className="filter-select"
                      />
                    )}
                  />
                </motion.div>
                {/*  Select status*/}
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Select Status
                  </label>
                  <Controller
                    name="status"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <Select
                        allowClear
                        style={{ width: "100%" }}
                        placeholder="Select status"
                        options={statusOptions}
                        value={field.value}
                        onChange={field.onChange}
                        className="filter-select"
                      />
                    )}
                  />
                </motion.div>
                {/*  Select form type*/}
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Select Form Type
                  </label>
                  <Controller
                    name="formType"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <Select
                        allowClear
                        mode="multiple"
                        style={{ width: "100%" }}
                        placeholder="Select form type"
                        options={formOptions}
                        value={field.value}
                        onChange={field.onChange}
                        className="filter-select"
                      />
                    )}
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
                    {[0, 1, 7, 30].map((days) => (
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
                  <div className="flex gap-2 flex-wrap mt-2">
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

                {/* Date Pickers */}
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.4 }}
                  className="grid grid-cols-1 gap-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                      From Date
                    </label>
                    <Controller
                      control={control}
                      name="fromDate"
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value}
                          onChange={field.onChange}
                          className="w-full px-4 py-3 rounded-lg border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white transition-all"
                          placeholderText="Select start date"
                          dateFormat="dd/MM/yyyy"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                      To Date
                    </label>
                    <Controller
                      control={control}
                      name="toDate"
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value}
                          onChange={field.onChange}
                          className="w-full px-4 py-3 rounded-lg border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white transition-all"
                          placeholderText="Select end date"
                          dateFormat="dd/MM/yyyy"
                        />
                      )}
                    />
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.5 }}
                  className="flex justify-end gap-3 mt-8 pt-6 border-t border-purple-50"
                >
                  <motion.button
                    type="button"
                    whileHover={{ x: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      reset();
                      setIsOpen(false);
                    }}
                    className="px-6 py-2 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-600 text-white hover:from-purple-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    Apply Filters
                  </motion.button>
                </motion.div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
