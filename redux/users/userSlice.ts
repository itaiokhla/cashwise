import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../store";
import { IUsers } from "@app/_interface/user.interface";

// Define the initial state using that type
const initialState: IUsers = {
  _id: null,
  name: "",
  email: "",
  password: "",
  createdAt: null,
  updatedAt: null,
  role: "",
  phone: null,
  createdBy: null,
  type: "",
};
       
export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<IUsers>) => {
      return { ...action.payload }; // Set the user data
    },
    clearUser: () => initialState, // Reset user state to initial state
  },
});

export const { setUser, clearUser } = userSlice.actions;

// Selector for getting user state
export const selectUser = (state: RootState) => state.user;

export default userSlice.reducer;
