import { CookiesHandler } from "@/utils/storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const ledgerApi = createApi({
  reducerPath: "ledgerApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers) => {
      // Add any authentication headers if needed
      const token = CookiesHandler.getCookieValue("accessToken");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Ledger"],
  endpoints: (builder) => ({
    // CREATE Ledger
    createLedger: builder.mutation({
      query: (ledgerData) => ({
        url: "/ledger",
        method: "POST",
        body: ledgerData,
      }),
      invalidatesTags: ["Ledger"],
    }),

    // GET All Ledgers with optional filters
    getLedgers: builder.query({
      query: ({ ledgerName = "", groupName = "", isActive = "" }:any = {}) => {
        const params = new URLSearchParams();
        if (ledgerName) params.append("ledgerName", ledgerName);
        if (groupName) params.append("groupName", groupName);
        if (isActive) params.append("isActive", isActive);
        
        return `/ledger?${params.toString()}`;
      },
      providesTags: ["Ledger"],
    }),

    // UPDATE Ledger
    updateLedger: builder.mutation({
      query: (ledgerData) => ({
        url: "/ledger",
        method: "PUT",
        body: ledgerData,
      }),
      invalidatesTags: ["Ledger"],
    }),

    // DELETE Ledger
    deleteLedger: builder.mutation({
      query: (id) => ({
        url: `/ledger?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Ledger"],
    }),
  }),
});

export const {
  useCreateLedgerMutation,
  useGetLedgersQuery,
  useUpdateLedgerMutation,
  useDeleteLedgerMutation,
} = ledgerApi;