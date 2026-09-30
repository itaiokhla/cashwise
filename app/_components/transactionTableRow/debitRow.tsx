import React from 'react';
import { motion } from 'framer-motion';
import { MdDelete } from "react-icons/md";
import { toast } from 'react-toastify';
import { useDeleteCreditMutation } from '@app/_api_query/group.api';
import { useAppSelector } from '@redux/redux.hooks';
import { selectUser } from '@redux/users/userSlice';

interface TransactionDetail {
  updatedAt: string;
  money: number;
  reason: string;
  tallyEntry: string;
  remarks?: string;
  imageUrl?: string[];
}

interface CreditItem {
  _id: string;
  name: string;
  phone: string;
  transactionDetails: TransactionDetail[];
}

interface CreditRowProps {
  debitData: CreditItem[];
  user: {
    phone?: string;
  };
  name: {
    name: string;
    userId: string;
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN');
};

export default function DebitRow({ debitData, user, name }: CreditRowProps) {
  const loginUser: any = useAppSelector(selectUser)
  const [deleteCreditData] = useDeleteCreditMutation()
  const handleDelete = async (_id: string) => {
    const result = confirm("Are you sure to delete?")
    if (!result) {
      return
    }
    try {
      const response = await deleteCreditData({ userId: name.userId, _id }).unwrap()
      console.log("res", response)
      toast.success("Record deleted successfully!")
      window.location.reload()
    } catch (error: any) {
      console.log(error)
      toast.error(error.data.message || error.message)
    }
  }
  return (
    <>
      {debitData?.map((creditItem, index) =>
        creditItem.transactionDetails.map((detail: any, detailIndex) =>
          !detail.reason.includes("Expense") && (
            <motion.tr
              key={`${creditItem._id}-${detailIndex}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: detailIndex * 0.1 }}
              className="border-b border-gray-400 hover:bg-gray-100 cursor-pointer"
            >
              {detailIndex === 0 && (
                <td
                  rowSpan={creditItem.transactionDetails.length}
                  className="p-3 whitespace-nowrap"
                >
                  <span>{name.name} </span>
                  <br />
                  <span className='text-xs text-gray-600'>Credit To</span>
                  <br />
                  {user.phone && user.phone === creditItem.phone ? "Me" : creditItem.name}
                </td>
              )}

              <td className="p-3 border-l border-gray-400 whitespace-nowrap">
                {formatDate(detail.updatedAt)}
              </td>

              <td className="p-3 whitespace-nowrap">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="font-bold text-red-500"
                >
                  -{detail.money?.toLocaleString('en-IN')} ₹
                </motion.div>
              </td>

              <td className="p-3 capitalize">{detail.reason}</td>
              <td className="p-3 capitalize">N/A</td>

              <td className="p-3 capitalize">
                {detail.remarks || "N/A"}
              </td>

              <td className="p-3 flex flex-wrap gap-2">
                {detail.imageUrl?.map((file: any, fileIndex: number) => (
                  <motion.a
                    key={fileIndex}
                    href={file}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    className="hover:shadow-md transition-shadow"
                  >
                    <motion.img
                      key={fileIndex}
                      whileHover={{ scale: 1.1 }}
                      src={file}
                      alt="Transaction document"
                      className="h-10 w-10 object-cover rounded mr-2"
                      loading="lazy"
                    />
                  </motion.a>
                ))}
                {new Date(detail.updatedAt).toDateString() === new Date().toDateString() && loginUser._id.toString() === name.userId.toString() && (
                  <span className='text-xl text-red-500' onClick={(e) => { e.stopPropagation(), handleDelete(detail?._id) }}><MdDelete /></span>
                )}
              </td>
              <td className="p-3 capitalize">{detail?.tallyEntry || 'N/A'}</td>

            </motion.tr>
          )
        )
      )}
    </>
  );
}