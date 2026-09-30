import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";

type CloseDocumentProps = {
  closeModal: () => void;
  documentUrl: string; 
};

export default function DocumentView({ closeModal, documentUrl }: CloseDocumentProps) {
  // Determine the file type based on the URL
  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(documentUrl);
  const isPDF = /\.pdf$/i.test(documentUrl);
  const isOther = !isImage && !isPDF; // Check for other file types

  return (
    <>
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-50">
        {/* Modal Header */}
        <div className="flex justify-end items-center bg-gray-400 w-[90%] lg:w-[50%]">
          <button
            className="text-red-500 text-5xl hover:text-gray-700"
            onClick={closeModal}
          >
            &times;
          </button>
        </div>
        <div className="flex flex-col bg-gray-400 max-h-[calc(100vh-2em)] max-w-[calc(100vw-2em)] w-[90%] h-[90%] lg:w-[50%] p-2 shadow-lg relative overflow-hidden">
          {/* Document Display */}
          <div className="flex items-center justify-center border border-gray-300 overflow-hidden bg-gray-100 max-w-[90vw] h-[90vh]">
            {isImage ? (
              <Image
              fill
              src={documentUrl}
              alt={`Photo `}
              className="object-contain w-full h-full"
              />
            ) : isPDF ? (
              <iframe
                src={documentUrl}
                title="PDF Document"
                className="w-full h-full"
              />
            ) : isOther ? (
              <iframe
                src={documentUrl}
                title="Document Preview"
                className="w-full h-full"
              />
            ) : (
              <span className="text-gray-500">Unsupported format</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}