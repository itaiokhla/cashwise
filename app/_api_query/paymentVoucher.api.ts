
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const paymentVoucherApi = createApi({
  reducerPath: "paymentVoucherApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("token");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["PaymentVoucher"],
  endpoints: (builder) => ({
    // CREATE Payment Voucher
    createPaymentVoucher: builder.mutation({
      query: (voucherData) => ({
        url: "/payment-voucher",
        method: "POST",
        body: voucherData,
      }),
      invalidatesTags: ["PaymentVoucher"],
    }),

    // GET All Payment Vouchers with filters
    getPaymentVouchers: builder.query({
      query: ({
        voucherNumber = "",
        fromDate = "",
        toDate = "",
        status = "",
        ledgerName = "",
        cashBankLedgerName = "",
        instrumentType = "",
      }: any = {}) => {
        const params = new URLSearchParams();
        if (voucherNumber) params.append("voucherNumber", voucherNumber);
        if (fromDate) params.append("fromDate", fromDate);
        if (toDate) params.append("toDate", toDate);
        if (status) params.append("status", status);
        if (ledgerName) params.append("ledgerName", ledgerName);
        if (cashBankLedgerName) params.append("cashBankLedgerName", cashBankLedgerName);
        if (instrumentType) params.append("instrumentType", instrumentType);

        return `/payment-voucher?${params.toString()}`;
      },
      providesTags: ["PaymentVoucher"],
    }),

    // UPDATE Payment Voucher
    updatePaymentVoucher: builder.mutation({
      query: (voucherData) => ({
        url: "/payment-voucher",
        method: "PUT",
        body: voucherData,
      }),
      invalidatesTags: ["PaymentVoucher"],
    }),

    // DELETE Payment Voucher
    deletePaymentVoucher: builder.mutation({
      query: (id) => ({
        url: `/payment-voucher?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PaymentVoucher"],
    }),
  }),
});

export const {
  useCreatePaymentVoucherMutation,
  useGetPaymentVouchersQuery,
  useUpdatePaymentVoucherMutation,
  useDeletePaymentVoucherMutation,
} = paymentVoucherApi;
