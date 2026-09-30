import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCloseLine } from "react-icons/ri";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useForm } from "react-hook-form";
import Loader from "@app/_components/Loader";
import client from "@createRequest";
import { toast } from "react-toastify";
import { SiteInterface } from "@app/_interface/site.interface";
import { useRouter } from "next/navigation";

type CreateSiteProps = {
  closeModal: () => void;
  siteData: SiteInterface;
};

export default function CreateSite({ closeModal, siteData }: CreateSiteProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteInterface>({
    defaultValues: {
      _id: siteData._id,
      name: siteData.name,
      address: siteData.address,
      createdBy: siteData.createdBy,
      status: siteData.status,
    },
  });

  const onSubmit = async (data: SiteInterface) => {
    try {
      setLoading(true);
      const response = await client.post("/site", data);
      if (response.status === 201 || response.status === 200) {
        toast.success(
          response?.data?.message || "New Site created successfully"
        );
        reset();
        closeModal();
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create Site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm "
        onClick={closeModal}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 "
        >
          <div className="flex items-center justify-between p-4 border-b border-violet-100">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold text-violet-800"
            >
              Add New Site
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
                  {...register("name", { required: "Site Name is required!" })}
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
                  Site Address
                </label>
                <textarea
                  id=""
                  rows={2}
                  {...register("address")}
                  className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                />
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
                  Status
                </motion.label>

                <motion.select
                  whileHover={{ scale: 1.01 }}
                  whileFocus={{ scale: 1.02 }}
                  className="w-full px-4 py-2 rounded-lg border border-violet-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-colors"
                  {...register("status")}
                >
                  <option value="" disabled>
                    Site Status
                  </option>
                  <motion.option value="active" whileHover={{ scale: 1.05 }}>
                    Active
                  </motion.option>
                  <motion.option value="inactive" whileHover={{ scale: 1.05 }}>
                    Inactive
                  </motion.option>
                </motion.select>
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
                  {loading ? <Loader /> : "Add Site"}
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
}
