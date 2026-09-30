import { CookiesHandler } from "@/utils/storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface ExpenseLimitRecord {
  _id: string;
  name: string;
  userId: string;
  conveyance: number;
  purchase: number;
  food: number;
  tea: number;
  hotel: number;
  labour: number;
  courier: number;
  loading: number;
  porter: number;
  cartage: number;
  rider: number;
  daily_wages: number;
  transport: number;
  maintenance: number;
  contractor: number;
  other: number;
  max_limit: number;
  status: "Active" | "In-Active" | "Blocked";
  createdBy: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface GetExpenseLimitsParams {
  name?: string;
  page?: number;
  limit?: number;
}

export interface GetExpenseLimitsResponse {
  type: "SUCCESS" | "ERROR";
  result: ExpenseLimitRecord[];
  message?: string;
}

export interface UpdateExpenseLimitPayload {
  data: Partial<ExpenseLimitRecord>;
  actionType: "new" | "old";
  actionSave: "permanent" | "temporary";
  usersToChange: string[];
  selectAllChecked: boolean;
  createdBy: string;
  // for actionType === 'new'
  name?: string;
  userId?: string;
}

export interface MutationResponse {
  type: "SUCCESS" | "ERROR";
  message: string;
}

export const expenseLimitApi = createApi({
  reducerPath: "expenseLimitApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers) => {
      const token = CookiesHandler.getCookieValue("accessToken");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["ExpenseLimit"],
  endpoints: (builder) => ({

    // GET — paginated list with optional name filter
    getExpenseLimits: builder.query<GetExpenseLimitsResponse, GetExpenseLimitsParams>({
      query: ({ name = "", page = 1, limit = 10 } = {}) => {
        const params = new URLSearchParams();
        if (name) params.append("name", name);
        params.append("page", String(page));
        params.append("limit", String(limit));
        return `/admin/expenseLimit?${params.toString()}`;
      },
      providesTags: (result) =>
        result?.result
          ? [
              ...result.result.map(({ _id }) => ({
                type: "ExpenseLimit" as const,
                id: _id,
              })),
              { type: "ExpenseLimit", id: "LIST" },
            ]
          : [{ type: "ExpenseLimit", id: "LIST" }],
    }),

    // GET single — by userId
    getExpenseLimitByUserId: builder.query<
      GetExpenseLimitsResponse,
      { userId: string }
    >({
      query: ({ userId }) => `/admin/expenseLimit?userId=${userId}&limit=1`,
      providesTags: (_result, _err, { userId }) => [
        { type: "ExpenseLimit", id: userId },
      ],
    }),

    // CREATE — actionType: 'new'
    createExpenseLimit: builder.mutation<
      MutationResponse,
      { name: string; userId: string; createdBy: string }
    >({
      queryFn: async ({ name, userId, createdBy }, _api, _extra, baseQuery) => {
        const formData = new FormData();
        formData.append("actionType", "new");
        formData.append("name", name);
        formData.append("userId", userId);
        formData.append("createdBy", createdBy);
        formData.append("data", JSON.stringify({}));
        formData.append("usersToChange", JSON.stringify([]));
        formData.append("actionSave", "permanent");
        formData.append("selectAllChecked", "false");
        const result = await baseQuery({
          url: "/admin/expenseLimit",
          method: "PUT",
          body: formData,
        });
        if (result.error) return { error: result.error };
        return { data: result.data as MutationResponse };
      },
      invalidatesTags: [{ type: "ExpenseLimit", id: "LIST" }],
    }),

    // UPDATE — actionType: 'old', single or bulk
    updateExpenseLimit: builder.mutation<
      MutationResponse,
      {
        data: Partial<ExpenseLimitRecord>;
        usersToChange: string[];
        selectAllChecked: boolean;
        actionSave: "permanent" | "temporary";
        createdBy: string;
      }
    >({
      queryFn: async (
        { data, usersToChange, selectAllChecked, actionSave, createdBy },
        _api,
        _extra,
        baseQuery
      ) => {
        const formData = new FormData();
        formData.append("actionType", "old");
        formData.append("data", JSON.stringify(data));
        formData.append("usersToChange", JSON.stringify(usersToChange));
        formData.append("selectAllChecked", String(selectAllChecked));
        formData.append("actionSave", actionSave);
        formData.append("createdBy", createdBy);
        const result = await baseQuery({
          url: "/admin/expenseLimit",
          method: "PUT",
          body: formData,
        });
        if (result.error) return { error: result.error };
        return { data: result.data as MutationResponse };
      },
      invalidatesTags: (_result, _err, { usersToChange, selectAllChecked }) =>
        selectAllChecked
          ? [{ type: "ExpenseLimit", id: "LIST" }]
          : usersToChange.map((id) => ({ type: "ExpenseLimit" as const, id })),
    }),
   sendExpenseOTP: builder.mutation({
  query: (body) => ({
    url: '/admin/expenseLimit',
    method: "PATCH",
    body,
  }),
  }),
   verifyExpenseOTP: builder.mutation({
  query: (body) => ({
    url: '/admin/expenseLimit',
    method: "POST",
    body,
  }),
   }),
  }),
});

export const {
  useGetExpenseLimitsQuery,
  useGetExpenseLimitByUserIdQuery,
  useCreateExpenseLimitMutation,
  useUpdateExpenseLimitMutation,
  useSendExpenseOTPMutation,
  useVerifyExpenseOTPMutation
} = expenseLimitApi;