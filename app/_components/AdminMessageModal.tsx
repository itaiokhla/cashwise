import React, { useState } from "react";
import { IoSend } from "react-icons/io5";
import { useForm, SubmitHandler } from "react-hook-form";

type MessageData = {
  adminMessage?: string;
};

type MessageProps = {
  onWriteMessage: (messageData: MessageData, expenseData: any) => void;
  expenseData: any; // Add expenseData prop type
  closeModal:()=>void
};

export default function AdminMessageModal({ onWriteMessage, expenseData,closeModal }: MessageProps) {

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MessageData>({
    defaultValues: {
      adminMessage: "",
    },
  });

  const onSubmit: SubmitHandler<MessageData> = (data) => {
    // Use the passed expenseData directly
    onWriteMessage(data, expenseData);
    
    reset();
  };

  return (
    <>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => {
            closeModal();
            setValue("adminMessage", "");
          }}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                Admin Message
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700 text-3xl"
                onClick={() => {
                  closeModal();
                  setValue("adminMessage", "");
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block font-medium mb-2 text-gray-700">
                  Message
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter your message here..."
                  {...register("adminMessage", {
                    required: "Message is required",
                  })}
                  className={`w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 ${
                    errors.adminMessage
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-purple-500"
                  }`}
                />
                {errors.adminMessage && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.adminMessage.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-purple-500 text-white px-6 py-2 rounded-md hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <IoSend className="text-lg" />
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
     
    </>
  );
}