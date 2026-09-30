import { CookiesHandler } from "@/utils/storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const journalVoucherApi = createApi({
  reducerPath: "journalVoucherApi",
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
  tagTypes: ["JournalVoucher"],
  endpoints: (builder) => ({
    // CREATE Journal Voucher
    createJournalVoucher: builder.mutation({
      query: (voucherData) => ({
        url: "/journal-voucher",
        method: "POST",
        body: voucherData,
      }),
      invalidatesTags: ["JournalVoucher"],
    }),

    // GET All Journal Vouchers with filters
    getJournalVouchers: builder.query({
      query: ({
        voucherNumber = "",
        fromDate = "",
        toDate = "",
        status = "",
        ledgerName = "",
      }:any = {}) => {
        const params = new URLSearchParams();
        if (voucherNumber) params.append("voucherNumber", voucherNumber);
        if (fromDate) params.append("fromDate", fromDate);
        if (toDate) params.append("toDate", toDate);
        if (status) params.append("status", status);
        if (ledgerName) params.append("ledgerName", ledgerName);

        return `/journal-voucher?${params.toString()}`;
      },
      providesTags: ["JournalVoucher"],
    }),

    // UPDATE Journal Voucher
    updateJournalVoucher: builder.mutation({
      query: (voucherData) => ({
        url: "/journal-voucher",
        method: "PUT",
        body: voucherData,
      }),
      invalidatesTags: ["JournalVoucher"],
    }),

    // DELETE Journal Voucher
    deleteJournalVoucher: builder.mutation({
      query: (id) => ({
        url: `/journal-voucher?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["JournalVoucher"],
    }),
  }),
});

export const {
  useCreateJournalVoucherMutation,
  useGetJournalVouchersQuery,
  useUpdateJournalVoucherMutation,
  useDeleteJournalVoucherMutation,
} = journalVoucherApi;