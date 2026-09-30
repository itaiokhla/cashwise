"use client";

import { useGetDayBalanceQuery } from "@app/_api_query/report.api";
import React, { useRef, useEffect } from "react";

type Props = {
  fromDate: string;
  toDate: string;
  userId: string;
};

export default function DayBalanceCard({ fromDate, toDate, userId }: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useGetDayBalanceQuery({
    fromDate,
    toDate,
    usersId: [userId],
  });

  // ✅ Helper for rounding + formatting
  const formatAmount = (num: number) =>
    Math.round(num).toLocaleString("en-IN");

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ✅ Get user data (flat API)
  const userData = data?.data?.find((d: any) => d.userId === userId);
  const balance = userData?.balance ?? 0;

  if (isLoading) {
    return <span className="text-gray-400 text-xs">Loading…</span>;
  }

  return (
    <div ref={ref} className="relative inline-block">
      {/* Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex items-center gap-1 group"
      >
        <span
          className={`text-sm font-medium w-16 text-left ${
            balance > 0
              ? "text-green-600"
              : balance < 0
              ? "text-red-600"
              : "text-gray-500"
          }`}
        >
          ₹{formatAmount(balance)}
        </span>

        <span
          className={`text-xs text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          ▲
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-purple-600 text-white text-xs font-semibold px-3 py-2 flex justify-between">
            <span>Date-wise Balance</span>
            <span>Running Total</span>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {userData ? (
              <div className="px-3 py-2 text-xs hover:bg-gray-50">
                {/* Date + Balance */}
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-gray-700">
                    {new Date(userData.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>

                  <span
                    className={`font-bold ${
                      userData.balance > 0
                        ? "text-green-600"
                        : userData.balance < 0
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    ₹{formatAmount(userData.balance)}
                  </span>
                </div>

                {/* Totals */}
                <div className="flex gap-3 text-gray-500">
                  <span className="text-green-600">
                    +₹{formatAmount(userData.totalCredit)}
                  </span>
                  <span className="text-red-500">
                    −₹{formatAmount(userData.totalDebit)}
                  </span>
                </div>

                {/* Transactions */}
                {(userData.credit?.length > 0 ||
                  userData.debit?.length > 0) && (
                  <div className="mt-1 pl-2 border-l-2 border-gray-200 space-y-0.5">
                    {userData.credit?.map((txn: any, i: number) => (
                      <div
                        key={`c-${i}`}
                        className="flex justify-between text-green-600"
                      >
                        <span>
                          {new Date(txn.date).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>+₹{formatAmount(txn.amount)}</span>
                      </div>
                    ))}

                    {userData.debit?.map((txn: any, i: number) => (
                      <div
                        key={`d-${i}`}
                        className="flex justify-between text-red-500"
                      >
                        <span>
                          {new Date(txn.date).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>−₹{formatAmount(txn.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-4 text-xs">
                No transactions in this range
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}