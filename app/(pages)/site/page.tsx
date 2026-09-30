"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios, { AxiosError } from "axios";
import Sidebar from "@app/_components/Sidebar";
import Loader from "@app/_components/Loader";
import { toast } from "react-toastify";
import client from "@createRequest";
import { FiRefreshCw, FiUserPlus } from "react-icons/fi";
import { RiCloseLine, RiLockPasswordLine } from "react-icons/ri";
import { FaPen } from "react-icons/fa6";
import { SiteInterface } from "@app/_interface/site.interface";
import CreateSite from "@app/_components/SiteComp/CreateSite";

export default function SitePage() {
  const [sites, setSites] = useState<SiteInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const Error = (data: any) => toast.error(data);
  const Success = (data: any) => toast.success(data);
  const [createUserModal, setCreateUserModal] = useState<boolean>(false);
  const [siteData, setSiteData] = useState<SiteInterface>({
    _id: null,
    name: "",
    address: "",
    createdBy: "",
    status: "",
  });

  // Fetch users data
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedData = localStorage.getItem("currentUser");
      if (storedData) {
        console.log("storedata from form", storedData);
      }
    }
    const fetchSite = async () => {
      setIsLoading(true);
      try {
        const response = await client.get("/site");
        setSites((response as any)?.data);
      } catch (error) {
        console.error("Error fetching users:", error);
        Error("Please Refresh Page to load data!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSite();
  }, []);

  const openCreateSiteModal = () => {
    setShowModal(true);
  };
  const closeCreateSiteModal = () => {
    setShowModal(false);
  };
  const handleNewCreate = () => {
    setSiteData({
      _id: null,
      name: "",
      address: "",
      createdBy: "",
      status: "",
    });
    openCreateSiteModal();
  };
  return (
    <div className="flex max-h-screen  my-12 md:my-0">
      <Sidebar />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 p-4 md:p-8 "
      >
        <div className="w-[95vw] md:w-[75vw] mx-auto">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="flex items-center justify-between mb-4"
          >
            <h2 className="text-lg md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
              Site Management
            </h2>

            <motion.button
              onClick={(e) => {
                e.preventDefault(), handleNewCreate();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <FiUserPlus className="text-lg" />
              <span>New Site</span>
            </motion.button>
          </motion.div>

          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-purple-50">
                  <tr>
                    {["Site Name", "Address", "Status", "Action"].map(
                      (header, index) => (
                        <th
                          key={index}
                          className="px-6 py-4 text-left text-sm font-semibold text-purple-800"
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-purple-100">
                  <AnimatePresence>
                    {sites.map((site, index) => (
                      <motion.tr
                        key={site._id?.toString()}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`hover:bg-purple-50/50 ${
                          site.status === "active" ? "" : "line-through"
                        }`}
                      >
                        <td className="px-6 py-4 text-sm text-gray-700 ">
                          {site.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {site.address ? site.address : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-purple-700 font-medium">
                          <span
                            className={`px-3 py-1 bg-purple-100 rounded-full capitalize ${
                              site.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {site.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSiteData(site), openCreateSiteModal();
                            }}
                            className="flex items-center text-purple-600 hover:text-purple-700"
                          >
                            <FaPen />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {sites.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-32 flex items-center justify-center text-gray-500"
              >
                No Site found
              </motion.div>
            )}
          </div>
        </div>
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <Loader />
          </div>
        )}
      </motion.div>
      {showModal && (
        <CreateSite closeModal={closeCreateSiteModal} siteData={siteData} />
      )}
    </div>
  );
}
