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
import CreateUser from "@app/_components/UsersComp/CreateUser";
import { IUsers } from "@app/_interface/user.interface";
import { FaPen } from "react-icons/fa6";
import { set } from "mongoose";

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
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
  const [userData, setUserData] = useState<IUsers>({
    _id: null,
    name: "",
    email: "",
    password: "",
    createdAt: null,
    updatedAt: null,
    createdBy: null,
    role: "",
    phone: null,
    type: "",
  });

  // Fetch users data
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedData = localStorage.getItem("currentUser");
      if (storedData) {
        console.log("storedata from form", storedData);
      }
    }
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await client.get("/users");
        setUsers((response as any)?.data);
      } catch (error) {
        console.error("Error fetching users:", error);
        Error("Please Refresh Page to load data!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const openCreateUserModal = () => {
    setCreateUserModal(true);
  };
  const closeCreateUserModal = () => {
    setCreateUserModal(false);
  };
  const handleNewCreate = () => {
    setUserData({
      _id: null,
      name: "",
      email: "",
      password: "",
      createdAt: null,
      updatedAt: null,
      createdBy: null,
      role: "",
      phone: null,
      type: "",
    });
    openCreateUserModal();
  };
  return (
    <div className="flex max-h-screen my-12 md:my-0">
      <Sidebar />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 p-6 md:p-8 lg:p-10"
      >
        <div className="w-[96vw] md:w-[70vw] mx-auto">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
              User Management
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
              <span>New User</span>
            </motion.button>
          </motion.div>

          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="overflow-auto h-[70vh]">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-purple-50">
                  <tr>
                    {["Name", "Email", "Phone", "Role", "Type", "Actions"].map(
                      (header, index) => (
                        <th
                          key={index}
                          className="sticky top-0 z-10 px-6 py-4 text-left text-sm font-semibold text-purple-800 bg-purple-50"
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-purple-100">
                  <AnimatePresence>
                    {users.map((user, index) => (
                      <motion.tr
                        key={user._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-purple-50/50"
                      >
                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {user.email || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <a
                            href={`tel:${user.phone}`}
                            className="text-purple-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {user.phone || "N/A"}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm text-purple-700 font-medium">
                          <span className="px-3 py-1 bg-purple-100 rounded-full capitalize">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {user.type || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setUserData(user);
                              openCreateUserModal();
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

            {users.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-32 flex items-center justify-center text-gray-500"
              >
                No users found
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
      {createUserModal && (
        <CreateUser closeModal={closeCreateUserModal} userData={userData} />
      )}
    </div>
  );
};

export default UsersPage;
