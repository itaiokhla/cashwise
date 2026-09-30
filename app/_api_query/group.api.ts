import { CookiesHandler } from "@/utils/storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const groupApi = createApi({
  reducerPath: "groupApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers) => {
      const token = CookiesHandler.getCookieValue("accessToken");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Group", "Files", "Users", "Account"],
  endpoints: (builder) => ({
    getGroup: builder.query({
      query: (params: Record<string, any>) => {
        const searchParams = new URLSearchParams(params).toString();
        return `/group`;
      },
      providesTags: ["Group"],
    }),
    getUsers: builder.query({
      query: (params: Record<string, any>) => {
        const searchParams = new URLSearchParams(params).toString();
        return `/users`;
      },
      providesTags: ["Users"],
    }),
    createGroup: builder.mutation({
      query: (data) => ({
        url: "/group",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Group"],
    }),
    updateGroup: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/group`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Group"],
    }),
    updateGroupMember: builder.mutation({
      query: (data) => ({
        url: `/group`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Group"],
    }),
    adminActionExpense: builder.mutation({
      query: (data) => ({
        url: `/users/expenses`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["Account"],
    }),
    deleteGroup: builder.mutation({
      query: (data) => ({
        url: "/group",
        method: "DELETE",
        body: data,
      }),
    }),
    uploadNewFiles: builder.mutation({
      query: (data) => ({
        url: "/users/expenses",
        method: "PATCH",
        body: data,
      }),
    }),
    getUsersAccountAndExpenseData: builder.query({
      query: (params: Record<string, any>) => {
        const searchParams = new URLSearchParams(params).toString();
        return `/admin/account?${searchParams}`;
      },
      providesTags: ["Account"],
    }),
    deleteCredit: builder.mutation({
      query: (params: Record<string, any>) => {
        const searchParams = new URLSearchParams(params).toString();

        return {
          url: `/account/transaction?${searchParams}`,
          method: 'DELETE',
        };
      },
    }),
    deleteExpense: builder.mutation({
      query: (params: Record<string, any>) => {
        const searchParams = new URLSearchParams(params).toString();

        return {
          url: `/employeedashboard?${searchParams}`,
          method: 'DELETE',
        };
      },
    })

  }),
});

// Export hooks for usage in functional components
export const {
  useGetGroupQuery,
  useGetUsersQuery,
  useGetUsersAccountAndExpenseDataQuery,
  useAdminActionExpenseMutation,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useUpdateGroupMemberMutation,
  useUploadNewFilesMutation,
  useDeleteGroupMutation,
  useDeleteCreditMutation,
  useDeleteExpenseMutation
} = groupApi;
