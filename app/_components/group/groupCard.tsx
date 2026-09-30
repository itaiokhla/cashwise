/* eslint-disable @next/next/no-img-element */
import { useUpdateGroupMemberMutation } from "@app/_api_query/group.api";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { FaEye } from 'react-icons/fa';
import { MdDelete } from "react-icons/md";

interface GroupData {
  _id: string;
  name: string;
  members: any[];
  createdAt: string;
  updatedAt: string;
}

interface GroupCardProps {
  groupData: GroupData[];
  hideJoinButton: boolean;
}

export default function GroupCard({
  groupData,
  hideJoinButton,
}: GroupCardProps) {
  const [newJoin, setNewJoin] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [newMember] = useUpdateGroupMemberMutation();
  const loginUser = useAppSelector(selectUser);
  const[viewingGroup ,setViewingGroup ]=useState<any>(null)
  const handleJoinGroup = async (groupId: string,userId:any,role:string) => {
    console.log(groupId,userId,role)
    try {
      const response = await newMember({
        documentId: groupId,
        role,
        userId:userId
      }).unwrap();
      console.log(response);
      if (response?.type === "SUCCESS") {
        toast.success(response?.message);
        setNewJoin(null);
      }
    } catch (error:any) {
      console.log(error);
      toast.error(error?.data?.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!groupData || !Array.isArray(groupData)) {
    return null;
  }
  console.log("hideJoinButton",hideJoinButton)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

      {groupData.map((item) => (
        <div
          key={item._id}
          className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-purple-200 transform hover:-translate-y-1"
        >
          {/* Header Section */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-50 p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3 relative">
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-6">
                  {(item.members.length > 3
                    ? item.members.slice(0, 3)
                    : item.members
                  ).map((member, index) => (
                    <img
                      key={index}
                      src="https://cdn3d.iconscout.com/3d/premium/thumb/user-3d-illustration-download-in-png-blend-fbx-gltf-file-formats--avatar-profile-account-interficon-set-2-light-pack-interface-illustrations-3105265.png?f=webp"
                      alt={`Member ${index + 1}`}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    />
                  ))}

                  {item.members.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                      +{item.members.length - 3}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-white px-2 py-1 rounded-full">
                {item.members.length}{" "}
                {item.members.length === 1 ? "member" : "members"}
              </div>
            </div>
            {viewingGroup?._id === item?._id && (
              <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                <div className="bg-gray-100 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-gray-800">
                        Members Are
                      </h2>
                      <button
                        onClick={() => setViewingGroup(null)}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="space-y-3">
                      {item.members.map((member) =>{
                        return (
                        <div
                          key={member._id}
                          className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
                        >
                          <img
                            src={
                              member.avatar ||
                              "https://cdn3d.iconscout.com/3d/premium/thumb/user-3d-illustration-download-in-png-blend-fbx-gltf-file-formats--avatar-profile-account-interficon-set-2-light-pack-interface-illustrations-3105265.png?f=webp"
                            }
                            alt="Member"
                            className="w-12 h-12 rounded-full"
                          />
                          <div>
                            <p className="font-semibold">{member?.user?.name}</p>
                            <p className="">{member?.role}</p>
                           
                          </div>
                          {(loginUser?.role==='admin' || loginUser?.role==='manager') && (
                          <div>
                            <MdDelete
                              className="text-2xl text-red-500 mr-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                const result = confirm(`Are you sure to remove ${member?.user?.name}?`);
                                if (result) {
                                  handleJoinGroup(item?._id, member?.user?._id, member?.role);
                                }
                              }}
                            />
                          </div>
                          ) }
                        </div>
                      )})}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">
                  {item.name}
                </h2>
                <p className="text-xs text-gray-500">
                  Created {formatDate(item.createdAt)}
                </p>
              </div>
              {!hideJoinButton && (
                <button
                  className="bg-gradient-to-r from-purple-500 to-purple-500 hover:from-purple-600 hover:to-purple-600 text-white font-medium px-3 py-2 rounded-lg shadow-md text-xs transition-all duration-200 hover:shadow-lg"
                  onClick={() => setNewJoin(item._id)}
                >
                  Join Group
                </button>
              )}
              {(loginUser?.role==='admin' || loginUser?.role==='manager') && (
              <button className="text-xl text-black" onClick={() => { setViewingGroup(item) }}><FaEye /></button>
              )}
            </div>
          </div>

          {/* Content Section */}
          <div className="p-4">
            {/* Role Statistics */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg">
                <span className="font-medium text-indigo-800 text-xs">
                  Manager
                </span>
                <span className="bg-indigo-600 text-white px-2 py-1 rounded-full text-xs">
                  {item.members.filter((i) => i.role === "Manager").length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                <span className="font-medium text-gray-800 text-xs">
                  Employees
                </span>
                <span className="bg-gray-600 text-white px-2 py-1 rounded-full text-xs">
                  {item.members.filter((i) => i.role === "Employee").length}
                </span>
              </div>
            </div>

            {/* Join Form */}
            {newJoin === item._id && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-gradient-to-r from-purple-50 to-purple-50 p-4 rounded-xl border border-purple-200">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm">
                    Select your role to join:
                  </h3>
                  <div className="space-y-2">
                    {["Manager", "Employee"].map((role) => (
                      <label
                        key={role}
                        className="flex items-center space-x-3 cursor-pointer group"
                      >
                        <input
                          type="radio"
                          name={`role-${item._id}`}
                          value={role}
                          checked={selectedRole === role}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-gray-700 group-hover:text-purple-700 transition-colors text-sm">
                          {role}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setNewJoin(null);
                      setSelectedRole("");
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleJoinGroup(item._id,loginUser?._id,selectedRole)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700 text-white font-semibold py-2 px-3 rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 text-sm"
                  >
                    Join Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

    </div>
  );
}
