import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCloseLine } from "react-icons/ri";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useForm } from "react-hook-form";
import Loader from "@app/_components/Loader";
import client from "@createRequest";
import { toast } from "react-toastify";
import { IUsers } from "@app/_interface/user.interface";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
type CreateUserProps = {
  closeModal: () => void;
  userData: IUsers;
};

const CreateUser = ({ closeModal, userData }: CreateUserProps) => {
  const user = useAppSelector(selectUser);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IUsers>({
    defaultValues: {
      _id: userData._id,
      name: userData.name,
      email: userData.email,
      password: "",
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      createdBy: userData.createdBy,
      role: userData.role,
      phone: userData.phone,
      type: userData.type,
    },
  });

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      const res = await client.post("/users", data);

      if (res.status === 201 || res.status === 200) {
        if (res.status === 201 && res?.data?.result) {
          const formData = new FormData()
          formData.append('actionType',"new")
          formData.append('name',res?.data?.result?.name)
          formData.append('userId',res?.data?.result?._id)
          formData.append('createdBy', user._id?.toString() || "")
          const response = await client.put("/admin/expenseLimit", formData);
        }
        toast.success(res?.data?.message || "User created successfully");
        reset();
        closeModal();
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {loading && <Loader />}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm overflow-auto"
        onClick={closeModal}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-auto my-8 max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 border-b border-violet-100">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold text-violet-800"
            >
              {userData._id ? "Update User" : "Add New User"}
            </motion.h3>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg"
              onClick={closeModal}
            >
              <RiCloseLine className="text-2xl" />
            </motion.button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="block text-sm font-medium text-violet-700 ">
                  Name
                </label>
                <input
                  type="text"
                  {...register("name", { required: "Name is required!" })}
                  className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                />
                {errors.name && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {errors.name.message as string}
                  </motion.p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="block text-sm font-medium text-violet-700">
                  Email
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="block text-sm font-medium text-violet-700">
                  Phone
                </label>
                <input
                  type="tel"
                  {...register("phone", {
                    required: "Phone Number is required!",
                  })}
                  className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                />
                {errors.phone && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {errors.phone.message as string}
                  </motion.p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-sm font-medium text-violet-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    whileTap={{ scale: 0.8 }}
                    className="absolute right-3 top-1/3  text-violet-600"
                  >
                    {showPassword ? (
                      <AiOutlineEye className="text-xl" />
                    ) : (
                      <AiOutlineEyeInvisible className="text-xl" />
                    )}
                  </motion.button>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  delay: 0.2,
                  type: "spring",
                  stiffness: 120,
                  damping: 12,
                }}
                className="relative"
              >
                <motion.label
                  className="block text-sm font-medium text-violet-700 "
                  whileHover={{ scale: 1.02 }}
                >
                  Role
                </motion.label>

                <motion.select
                  whileHover={{ scale: 1.01 }}
                  whileFocus={{ scale: 1.02 }}
                  className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                  {...register("role", { required: "Role is required!" })}
                >
                  <option value="" disabled>
                    User Role
                  </option>
                  <motion.option value="admin" whileHover={{ scale: 1.05 }}>
                    Admin
                  </motion.option>
                  <motion.option value="manager" whileHover={{ scale: 1.05 }}>
                    Manager
                  </motion.option>
                  <motion.option value="employee" whileHover={{ scale: 1.05 }}>
                    Employee
                  </motion.option>
                  <motion.option value="toPay" whileHover={{ scale: 1.05 }}>
                    To Pay
                  </motion.option>
                </motion.select>
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 120,
                    damping: 12,
                  }}
                  className="relative"
                >
                  <motion.label
                    className="block text-sm font-medium text-violet-700 mt-2 "
                    whileHover={{ scale: 1.02 }}
                  >
                    User Type
                  </motion.label>
                  <motion.select
                    whileHover={{ scale: 1.01 }}
                    whileFocus={{ scale: 1.02 }}
                    className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                    {...register("type")}
                  >
                    <option value="" disabled>
                      User Type
                    </option>
                    <motion.option value="travel" whileHover={{ scale: 1.05 }}>
                      Travel
                    </motion.option>
                    <motion.option value="office" whileHover={{ scale: 1.05 }}>
                      Office
                    </motion.option>
                    <motion.option value="toPay" whileHover={{ scale: 1.05 }}>
                      To Pay
                    </motion.option>
                  </motion.select>
                </motion.div>
                <AnimatePresence>
                  {errors.role && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="text-red-500 text-sm mt-1 absolute"
                    >
                      {errors.role.message as string}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  {userData._id ? "Update" : "Add "}
                </button>
              </motion.div>
            </div>
          </form>
        </motion.div>

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <Loader />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateUser;
