"use client";
import { useGetGroupQuery } from "@app/_api_query/group.api";
import GroupCard from "@app/_components/group/groupCard";
import GroupForm from "@app/_components/group/groupForm";
import Sidebar from "@app/_components/Sidebar";
import Item from "@node_modules/antd/es/list/Item";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import React from "react";

export default function Group() {
  const { data: groups, error, isLoading, isSuccess } = useGetGroupQuery({});
  const user = useAppSelector(selectUser);
  const hideJoinGroup = groups?.result.some((group: any) =>
    group.members?.some((item: any) => item.user._id.toString() === user?._id)
  );
  return (
    <div className="flex max-h-screen bg-gradient-to-br from-gray-50 to-gray-100 md:my-0">
      <Sidebar />

      <div className="flex-1 overflow-y-auto">
        <div className="w-full mx-auto max-w-7xl">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4  mt-8 md:mt-0">
              <div className="flex-1">
                <h1 className="text-3xl font-bold  mb-1 bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                  Groups
                </h1>
                <p className="text-gray-500">
                  Manage your groups and join new ones
                </p>
              </div>
              {(user?.role === "manager" || user?.role === "admin") && (
                <div>
                  <GroupForm />
                </div>
              )}
            </div>
          </div>

          {/* Groups Display Section */}
          <div className="space-y-2">
            {isLoading && (
              <div className="flex justify-center items-center py-8 bg-white rounded-lg border border-gray-200">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-3 text-gray-600">Loading groups...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-600">
                  Failed to load groups. Please try again.
                </p>
              </div>
            )}

            {isSuccess && groups?.result && (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Available Groups ({groups.result.length})
                  </h2>
                </div>

                {groups?.result.length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                    <div className="text-gray-400 mb-3">
                      <svg
                        className="w-12 h-12 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-lg mb-1">
                      No groups found
                    </p>
                    <p className="text-gray-500">
                      Create your first group to get started!
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-[60vh] overflow-auto">
                    <GroupCard
                      groupData={groups.result}
                      hideJoinButton={hideJoinGroup}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
