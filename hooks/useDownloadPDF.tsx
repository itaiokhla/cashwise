import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const useStyledPDFDownload = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  // ✅ Format Date in DD/MM/YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // ✅ Format amount: plain digits with 2 decimals
  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "0.00";
    return Number(amount).toFixed(2);
  };

  const getUserPhone = (user: any) => {
    if (user.credit?.[0]?.phone) return user.credit[0].phone;
    if (user.debit?.[0]?.phone) return user.debit[0].phone;
    return user.phone || "N/A";
  };

  const calculateTotalCredit = (user: any) => {
    let total = 0;
    user.credit?.forEach((creditEntry: any) => {
      creditEntry.transactionDetails?.forEach((transaction: any) => {
        total += transaction.money || 0;
      });
    });
    return total;
  };

  const calculateTotalDebit = (user: any) => {
    let total = 0;
    user.debit?.forEach((debitEntry: any) => {
      debitEntry.transactionDetails?.forEach((transaction: any) => {
        total += transaction.money || 0;
      });
    });
    return total;
  };

  const downloadStyledPDF = async (userData: any[]) => {
    if (!userData || userData.length === 0) {
      alert("No data available to generate PDF");
      return;
    }

    setIsGenerating(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const colors:any = {
        primary: [41, 128, 185],
        secondary: [52, 73, 94],
        light: [236, 240, 241],
        dark: [44, 62, 80],
        white: [255, 255, 255],
      };

      userData.forEach((user, userIndex) => {
        if (userIndex > 0) pdf.addPage();

        let yPos = 40;

        // Header Background
        pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.rect(0, 0, pageWidth, 35, "F");

        // Header Title
        pdf.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        pdf.setFontSize(22);
        pdf.setFont("helvetica", "bold");
        pdf.text("CASHWISE FINANCE REPORT", pageWidth / 2, 18, {
          align: "center",
        });

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`${user.name} (${getUserPhone(user)})`, pageWidth / 2, 28, {
          align: "center",
        });
        pdf.text("Credit - Debit Statement", pageWidth / 2, 34, {
          align: "center",
        });

        // Merge transactions
        const mergedTransactions: any[] = [];

        user.credit?.forEach((creditEntry: any) => {
          creditEntry.transactionDetails?.forEach((tx: any) => {
            mergedTransactions.push({
              date: tx.createdAt,
              credit: tx.money || 0,
              debit: 0,
              reason: tx.reason || "N/A",
              remarks: tx.remarks || "No remarks",
            });
          });
        });

        user.debit?.forEach((debitEntry: any) => {
          debitEntry.transactionDetails?.forEach((tx: any) => {
            mergedTransactions.push({
              date: tx.createdAt,
              credit: 0,
              debit: tx.money || 0,
              reason: tx.reason || "N/A",
              remarks: tx.remarks || "No remarks",
            });
          });
        });

        // Sort by date
        mergedTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Table data
        const tableData = mergedTransactions.map((tx) => [
          formatDate(tx.date),
          formatAmount(tx.credit),
          formatAmount(tx.debit),
          tx.reason,
          tx.remarks,
        ]);

        // ✅ Add totals row
        const totalCredit = calculateTotalCredit(user);
        const totalDebit = calculateTotalDebit(user);
        tableData.push([
          "TOTAL",
          formatAmount(totalCredit),
          formatAmount(totalDebit),
          "",
          "",
        ]);

        autoTable(pdf, {
          head: [["Date", "Credit", "Debit", "Reason", "Remarks"]],
          body: tableData,
          startY: yPos,
          theme: "grid",
          headStyles: {
            fillColor: colors.secondary,
            textColor: colors.white,
            fontSize: 10,
            halign: "center",
          },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { halign: "center", cellWidth: 25 },
            1: { halign: "right", cellWidth: 25 },
            2: { halign: "right", cellWidth: 25 },
            3: { halign: "left", cellWidth: 40 },
            4: { halign: "left", cellWidth: 65 },
          },
          margin: { left: 15, right: 15 },
          tableWidth: "wrap",
          // ✅ Highlight totals row
          didParseCell: (data) => {
            if (data.row.index === tableData.length - 1) {
              data.cell.styles.fillColor = [200, 230, 201]; // light green
              data.cell.styles.fontStyle = "bold";
            }
          },
        });

        // Footer
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Generated on: ${new Date().toLocaleString()}`, 15, pageHeight - 10);
        pdf.text(
          `Page ${userIndex + 1} of ${userData.length} | User: ${user.name}`,
          pageWidth - 15,
          pageHeight - 10,
          { align: "right" }
        );
      });

      pdf.save(`Cashwise_Financial_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return { downloadStyledPDF, isGenerating };
};

const StyledPDFGenerator = ({ userData,setResultData}:any) => {
  const { downloadStyledPDF, isGenerating } = useStyledPDFDownload();

  return (
    <div className="text-center">
      <button
        onClick={() =>{ downloadStyledPDF(userData), setResultData(null)}}
        className='p-2 rounded-xl font-semibold text-lg transition-all duration-300 transform bg-blue-500 text-white hover:bg-blue-600'
        
      >
       Download
      </button>
    </div>
  );
};

export default StyledPDFGenerator;
