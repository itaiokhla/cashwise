import { useCallback } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExpenseItem {
  amount: number;
  fieldName?: string;
  expenseDate?: string;
  title?: string;

  description?: string;
  remarks?: string;
  siteName?: string;
  todayWork?: string;
  paymentFiles?: string[];
  invoiceFiles?: string[];
  locationFiles?: string[];
  [key: string]: any;
}

interface Expense {
  createdAt: string;
  expenseType: string;
  [key: string]: any;
}

interface UserReport {
  userDetails: {
    name: string;
    phone: number;
  };
  expenses: Expense[];
}

interface UseDownloadExcelProps {
  data: UserReport[];
  format: string;
}

export const useDownloadExcel = () => {
  const downloadExcel = useCallback(
    async ({ data, format }: UseDownloadExcelProps) => {
      try {
        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Expense Report");

        // Define columns
        worksheet.columns = [
          { header: "Expense Date", key: "expenseDate", width: 15 },
          { header: "Name", key: "name", width: 20 },
          { header: "Phone", key: "phone", width: 15 },
          { header: "Expense Type", key: "expenseType", width: 15 },
          { header: "Field Name", key: "fieldName", width: 20 },
          { header: "Amount", key: "amount", width: 15 },
          { header: "Title", key: "title", width: 40 },
          { header: "Description", key: "description", width: 50 },
          { header: "Remarks", key: "remarks", width: 30 },
          { header: "File", key: "file", width: 10 },
        ];

        // Style for header row
        worksheet.getRow(1).eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD9D9D9" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });

        // Process data and add rows
        data.forEach((userReport: UserReport) => {
          const { name, phone } = userReport.userDetails;

          userReport.expenses.forEach((expense: Expense) => {
            const expenseDate = new Date(expense.createdAt);
            const formattedDate = `${expenseDate.getDate()}-${expenseDate.toLocaleString(
              "default",
              { month: "short" }
            )}-${expenseDate.getFullYear().toString().slice(-2)}`;

            // Process each field in expense (excluding createdAt and expenseType)
            Object.keys(expense).forEach((key) => {
              if (
                key !== "createdAt" &&
                key !== "expenseType" &&
                Array.isArray(expense[key])
              ) {
                expense[key].forEach((item: ExpenseItem) => {
                  // Get file URL for creating hyperlink
                  const fileUrl =
                    item.paymentFiles?.[0] ||
                    item.invoiceFiles?.[0] ||
                    item.locationFiles?.[0] ||
                    "";

                  const rowData = {
                    expenseDate: formattedDate,
                    name,
                    phone,
                    expenseType: expense.expenseType,
                    fieldName: key.charAt(0).toUpperCase() + key.slice(1),
                    amount: item.amount || 0,
                    title: item.siteName || item.todayWork || "",
                    description: item.description || "",
                    remarks: item.remarks || "",
                    file: fileUrl || "",
                  };

                  const row = worksheet.addRow(rowData);

                  // If there's a file URL, make it a hyperlink
                  if (fileUrl) {
                    const fileCell = row.getCell("file");
                    fileCell.value = {
                      text: "View File",
                      hyperlink: fileUrl,
                    };
                    fileCell.font = {
                      color: { argb: "FF0000FF" },
                      underline: true,
                    };
                  }
                });
              }
            });
          });
        });

        // Apply borders to all data rows
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            // Skip header row
            row.eachCell({ includeEmpty: true }, (cell) => {
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            });
          }
        });

        // Generate and save file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
        const filename = `Intertech_Cashwise_${format}_report_${timestamp}.xlsx`;

        saveAs(blob, filename);

        return { success: true, message: "Excel file downloaded successfully" };
      } catch (error) {
        console.error("Error generating Excel file:", error);
        return {
          success: false,
          message: "Failed to generate Excel file",
          error,
        };
      }
    },
    []
  );

  return { downloadExcel };
};

// Usage example:
/*
import { useDownloadExcel } from './hooks/useDownloadExcel';

const MyComponent = () => {
  const { downloadExcel } = useDownloadExcel();

  const handleDownloadReport = async () => {
    const response = await axios.post("/api/reports/userReports", reportData);
    
    if (response.status === 200) {
      const result = await downloadExcel({
        data: response.data.data,
        format: 'excel'
      });
      
      if (result.success) {
        console.log('Download completed successfully');
      } else {
        console.error('Download failed:', result.message);
      }
    }
  };

  return (
    <button onClick={handleDownloadReport}>
      Download Excel Report
    </button>
  );
};
*/
