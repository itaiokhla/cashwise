"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaExclamationTriangle } from "react-icons/fa";

export default function GlobalError() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center max-h-[90vh] max-w-md mt-12 m-auto rounded-lg shadow-2xl  bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-900 dark:to-gray-800"
    >
      <div className=" text-center p-8  ">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
        >
          <div className="relative inline-block">
            <FaExclamationTriangle className="text-red-500 text-6xl mb-6 animate-pulse" />
            <motion.div
              className="absolute -inset-4 border-4 border-red-200 rounded-full"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-5xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
            Oops!
          </h2>
          <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mt-4">
            Something Went Wrong
          </h3>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-md text-blue-800 dark:text-blue-300 leading-relaxed max-w-xl mx-auto"
        >
          We encountered an unexpected error. Don&apos;t worry - our team has
          been notified. Please try again later.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-700"
          >
            Return to Login
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
