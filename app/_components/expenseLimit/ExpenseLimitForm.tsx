"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { RxCross2 } from "react-icons/rx";
import { FiAlertTriangle, FiCheckCircle, FiSave, FiClock, FiUsers } from "react-icons/fi";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import {
  ExpenseLimitRecord,
  useUpdateExpenseLimitMutation,
} from "@app/_api_query/expenselimit.api";

// ─── Types ────────────────────────────────────────────────────────────────────

type LimitFormValues = {
  conveyance:  number;
  purchase:    number;
  food:        number;
  tea:         number;
  hotel:       number;
  labour:      number;
  courier:     number;
  loading:     number;
  porter:      number;
  cartage:     number;
  rider:       number;
  daily_wages: number;
  transport:   number;
  maintenance: number;
  contractor:  number;
  other:       number;
  max_limit:   number;
  status:      typeof STATUS_OPTIONS[number];
};

type Props = {
  closeModal: () => void;
  onSuccess?: () => void;
  selectedUsersExpenseLimit: ExpenseLimitRecord[];
  selectAllChecked: boolean;
};

// ─── Field config ─────────────────────────────────────────────────────────────

const LIMIT_FIELDS: {
  key: keyof Omit<LimitFormValues, "status">;
  label: string;
  icon: string;
}[] = [
  { key: "conveyance",  label: "Conveyance",  icon: "🚗" },
  { key: "purchase",    label: "Purchase",    icon: "🛍️" },
  { key: "food",        label: "Food",        icon: "🍽️" },
  { key: "tea",         label: "Tea",         icon: "☕" },
  { key: "hotel",       label: "Hotel",       icon: "🏨" },
  { key: "labour",      label: "Labour",      icon: "👷" },
  { key: "courier",     label: "Courier",     icon: "📦" },
  { key: "loading",     label: "Loading",     icon: "📤" },
  { key: "porter",      label: "Porter",      icon: "🧳" },
  { key: "cartage",     label: "Cartage",     icon: "🚚" },
  { key: "rider",       label: "Rider",       icon: "🏍️" },
  { key: "daily_wages", label: "Daily Wages", icon: "💼" },
  { key: "transport",   label: "Transport",   icon: "🚌" },
  { key: "maintenance", label: "Maintenance", icon: "🔧" },
  { key: "contractor",  label: "Contractor",  icon: "🏗️" },
  { key: "other",       label: "Other",       icon: "📋" },
];

const STATUS_OPTIONS = ["Active", "In-Active", "Blocked"] as const;

const statusStyle: Record<string, string> = {
  Active:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In-Active": "bg-amber-50  text-amber-700  border-amber-200",
  Blocked:     "bg-red-50    text-red-700    border-red-200",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpenseLimitForm({
  closeModal,
  onSuccess,
  selectedUsersExpenseLimit,
  selectAllChecked,
}: Props) {
  console.log("selectAllChecked",selectAllChecked)
  const user = useAppSelector(selectUser);
  const [saveMode, setSaveMode] = useState<"permanent" | "temporary">("permanent");
  const [updateLimit, { isLoading }] = useUpdateExpenseLimitMutation();

  // Seed with first selected user's values (or zeros for bulk-all)
  const seed = selectedUsersExpenseLimit[0];

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<LimitFormValues>({
    defaultValues: {
      conveyance:  seed?.conveyance  ?? 0,
      purchase:    seed?.purchase    ?? 0,
      food:        seed?.food        ?? 0,
      tea:         seed?.tea         ?? 0,
      hotel:       seed?.hotel       ?? 0,
      labour:      seed?.labour      ?? 0,
      courier:     seed?.courier     ?? 0,
      loading:     seed?.loading     ?? 0,
      porter:      seed?.porter      ?? 0,
      cartage:     seed?.cartage     ?? 0,
      rider:       seed?.rider       ?? 0,
      daily_wages: seed?.daily_wages ?? 0,
      transport:   seed?.transport   ?? 0,
      maintenance: seed?.maintenance ?? 0,
      contractor:  seed?.contractor  ?? 0,
      other:       seed?.other       ?? 0,
      max_limit:   seed?.max_limit   ?? 0,
      status:      seed?.status      ?? "Active",
    },
  });

  // Re-seed when selection changes
  useEffect(() => {
    if (seed) {
      reset({
        conveyance:  seed.conveyance,
        purchase:    seed.purchase,
        food:        seed.food,
        tea:         seed.tea,
        hotel:       seed.hotel,
        labour:      seed.labour,
        courier:     seed.courier,
        loading:     seed.loading,
        porter:      seed.porter,
        cartage:     seed.cartage,
        rider:       seed.rider,
        daily_wages: seed.daily_wages,
        transport:   seed.transport,
        maintenance: seed.maintenance,
        contractor:  seed.contractor,
        other:       seed.other,
        max_limit:   seed.max_limit,
        status:      seed.status,
      });
    }
  }, [seed, reset]);

  const onSubmit = async (data: LimitFormValues) => {
    try {
      const usersToChange = selectAllChecked
        ? []
        : selectedUsersExpenseLimit.map((u) => u.userId);

      const res = await updateLimit({
        data,
        usersToChange,
        selectAllChecked,
        actionSave: saveMode,
        createdBy: user?._id?.toString() ?? "",
      }).unwrap();

      if (res.type === "SUCCESS") {
        toast.success(res.message);
        onSuccess?.();
        closeModal();
      } else {
        toast.error(res.message || "Update failed");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Something went wrong");
    }
  };

  const selectedCount = selectAllChecked
    ? "All users"
    : `${selectedUsersExpenseLimit.length} user${selectedUsersExpenseLimit.length !== 1 ? "s" : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={closeModal}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              Update Expense Limits
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <FiUsers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <p className="text-xs text-purple-600 font-medium truncate">
                {selectedCount}
                {!selectAllChecked && selectedUsersExpenseLimit.length === 1 && seed?.name
                  ? ` · ${seed.name}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="ml-3 shrink-0 p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <RxCross2 className="w-5 h-5" />
          </button>
        </div>

        {/* ── Save mode toggle ── */}
        {/* <div className="px-4 sm:px-6 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Save Mode
          </p>
          <div className="flex gap-2">
            {(["permanent", "temporary"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSaveMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  saveMode === mode
                    ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                    : "bg-white border-gray-200 text-gray-500 hover:border-purple-300"
                }`}
              >
                {mode === "permanent" ? (
                  <FiSave className="w-3.5 h-3.5" />
                ) : (
                  <FiClock className="w-3.5 h-3.5" />
                )}
                {mode === "permanent" ? "Permanent" : "Temporary (30 min)"}
              </button>
            ))}
          </div>
          {saveMode === "temporary" && (
            <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
              <FiAlertTriangle className="w-3 h-3" />
              Changes will automatically revert after 30 minutes.
            </p>
          )}
        </div> */}

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-5">

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Account Status
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-medium ${statusStyle[s]}`}
                >
                  <input
                    type="radio"
                    value={s}
                    {...register("status")}
                    className="accent-purple-600"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Max limit banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <label className="block text-sm font-semibold text-purple-800 mb-1.5">
              Max Total Limit (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 font-medium pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                min={0}
                step={100}
                {...register("max_limit", { valueAsNumber: true, min: 0 })}
                className="w-full pl-8 pr-3 py-2.5 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 font-semibold text-purple-900"
              />
            </div>
            <p className="text-[11px] text-purple-500 mt-1">
              Sum of all expense fields must not exceed this value.
            </p>
          </div>

          {/* Per-field limits grid */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Per-Field Limits (₹)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {LIMIT_FIELDS.map(({ key, label, icon }) => (
                <div
                  key={key}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5 hover:border-purple-300 transition-colors"
                >
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
                    <span className="text-sm">{icon}</span>
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      {...register(key, { valueAsNumber: true, min: 0 })}
                      className="w-full pl-5 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bulk-edit notice */}
          {(selectAllChecked || selectedUsersExpenseLimit.length > 1) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                You are updating{" "}
                <strong>
                  {selectAllChecked ? "all users" : `${selectedUsersExpenseLimit.length} users`}
                </strong>{" "}
                at once. Each user's existing values will be replaced with the values entered above.
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 bg-gray-50 shrink-0">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            type="button"
            disabled={isLoading}
            onClick={handleSubmit(onSubmit)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all ${
              isLoading
                ? "bg-purple-300 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-200"
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                {saveMode === "permanent" ? <FiSave className="w-4 h-4" /> : <FiClock className="w-4 h-4" />}
                Save {saveMode === "temporary" ? "(30 min)" : "Changes"}
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}