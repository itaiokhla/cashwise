import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import userReducer from "./users/userSlice";
import filesReducer from "./files/filesSlice";
import { groupApi } from "@app/_api_query/group.api";
import { searchApi } from "@app/_api_query/global.search.api";
import { ledgerApi } from "@app/_api_query/ledger.api";
import { journalVoucherApi } from "@app/_api_query/journalVoucher.api";
import { paymentVoucherApi } from "@app/_api_query/paymentVoucher.api";
import { expenseLimitApi } from "@app/_api_query/expenselimit.api";
import { reportApi } from "@app/_api_query/report.api";

// Persist configurations for each reducer
const userPersistConfig = {
  key: "user", // Unique key for user reducer
  storage,
};

const filesPersistConfig = {
  key: "files",
  storage,
};
// Persistent reducers
const persistedUserReducer = persistReducer(userPersistConfig, userReducer);

// Configure store
export const store = configureStore({
  reducer: {
    user: persistedUserReducer,
    files: filesReducer,
    [groupApi.reducerPath]: groupApi.reducer,
    [searchApi.reducerPath]: searchApi.reducer,
    [ledgerApi.reducerPath]: ledgerApi.reducer,
    [journalVoucherApi.reducerPath]: journalVoucherApi.reducer,
    [paymentVoucherApi.reducerPath]: paymentVoucherApi.reducer,
    [expenseLimitApi.reducerPath]: expenseLimitApi.reducer,
    [reportApi.reducerPath]: reportApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
          "persist/REGISTER",
          "persist/PAUSE",
          "persist/PURGE",
          "persist/FLUSH",
        ],
      },
    }).concat(
      groupApi.middleware,
      searchApi.middleware,
      ledgerApi.middleware,
      journalVoucherApi.middleware,
      paymentVoucherApi.middleware,
      expenseLimitApi.middleware,
      reportApi.middleware,
    ),
});

// Infer types for the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Persistor for managing rehydration
export const persistor = persistStore(store);
