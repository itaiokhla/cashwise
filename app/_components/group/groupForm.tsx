import { useCreateGroupMutation } from "@app/_api_query/group.api";
import { toast } from "react-toastify";
import React, { useState } from "react";

export default function GroupForm() {
  const [open, setOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [createGroup] = useCreateGroupMutation();
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const response = await createGroup({ title: groupTitle }).unwrap();
      if (response.type === "SUCCESS") {
        toast.success(response?.data?.message);
        setOpen(false);
        setGroupTitle("");
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error?.data?.message);
    }
  };

  return (
    <div className="">
      <button
        onClick={() => setOpen(true)}
        className="bg-purple-500  text-white font-semibold py-2 px-4 rounded-md"
      >
        Create New Group
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gradient-to-br from-gray-100 to-gray-300 text-white p-6 rounded-2xl shadow-xl w-full max-w-md">
            <h2 className="text-2xl text-purple-500 font-bold mb-4">
              Create New Group
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col">
                <label
                  htmlFor="groupTitle"
                  className="mb-1 font-semibold text-black"
                >
                  Group Title
                </label>
                <input
                  id="groupTitle"
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  className="text-black p-2 rounded-lg"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-gray-300 text-black px-4 py-2 rounded-md shadow-sm  hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
