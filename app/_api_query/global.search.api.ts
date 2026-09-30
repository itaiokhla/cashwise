import { CookiesHandler } from "@/utils/storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const searchApi = createApi({
  reducerPath: "searchApi",
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
  tagTypes: ["Search"],
  endpoints: (builder) => ({
    getSearch: builder.query({
      query: (params: Record<string, any>) => {
        const searchParams = new URLSearchParams(params).toString();
        return `/search?${searchParams}`;
      },
      providesTags: ["Search"],
    }),
  }),
});

export const { useGetSearchQuery } = searchApi;
