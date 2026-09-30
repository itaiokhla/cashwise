// components/ExpenseLimitReport.tsx
import React, { useState } from 'react';
import { FaFileDownload } from 'react-icons/fa';
import Loader from '../Loader';
import { toast } from 'react-toastify';
import client from '@createRequest';
import { ExpensePDFDownload } from './ExpensePDFDownload';

export default function ExpenseLimitReport() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [showPDF, setShowPDF] = useState(false);

  const handleReportDownload = async () => {
    setLoading(true);
    try {
      const response = await client.get('/reports/expenseLimitReport');
      if (response.status === 200) {
        const data = response?.data?.data || [];
        setReportData(data);
        setShowPDF(true);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.data?.message || 'Failed to download report.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      <button
        className="w-full flex items-center justify-center gap-2 text-sm p-3 rounded-md text-white bg-purple-500 hover:bg-purple-600 transition-colors"
        onClick={handleReportDownload}
      >
        <FaFileDownload /> Expense Limit Report
      </button>
      {showPDF && reportData.length > 0 && (
       
          <ExpensePDFDownload data={reportData} />
        
      )}
    </div>
  );
}
