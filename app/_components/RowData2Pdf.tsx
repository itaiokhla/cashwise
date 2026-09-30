import { useRef } from "react";
import { RiDownloadLine } from "react-icons/ri";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type RowData2PdfProps = {
  rowData: any;
};

const RowData2Pdf = ({ rowData }: RowData2PdfProps) => {
  const pdfRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleDownload = async () => {
    const input = pdfRef.current;
    if (!input) return;

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: true,
        width: 1200,
        height: input.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate image dimensions to fit page
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save(`expense-report-${formatDate(rowData.date)}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  // Calculate total amount
  const totalAmount = Object.keys(rowData).reduce((sum, key) => {
    if (Array.isArray(rowData[key])) {
      return (
        sum +
        rowData[key].reduce(
          (acc: number, item: any) => acc + (item.amount || 0),
          0
        )
      );
    }
    return sum;
  }, 0);

  return (
    <>
      <button
        onClick={handleDownload}
        className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2"
      >
        <RiDownloadLine className="text-lg" />
        PDF
      </button>

      {/* Hidden PDF content */}
      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={pdfRef} className="bg-white p-8 w-[1200px]">
          <h1 className="text-3xl font-bold mb-4 text-violet-800">
            Expense Report
          </h1>
          <div className="mb-6">
            <p className="text-lg text-gray-600">
              Date: {formatDate(rowData.date)}
            </p>
            <p className="text-lg text-gray-600">
              Total Expenses: ₹{totalAmount.toLocaleString("en-IN")}
            </p>
          </div>

          {Object.entries(rowData).map(
            ([category, items]) =>
              Array.isArray(items) &&
              items.length > 0 && (
                <div key={category} className="mb-6">
                  <h2 className="text-xl font-semibold mb-3 capitalize text-violet-700">
                    {category.replace(/([0-9])([A-Za-z])/g, "$1 $2")}
                  </h2>

                  <div className="space-y-4">
                    {(items as any[]).map((item, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="grid grid-cols-3 gap-4 mb-2">
                          <div>
                            <p className="font-medium text-gray-800">
                              Site Name
                            </p>
                            <p className="text-gray-600">{item.siteName}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">Amount</p>
                            <p className="text-violet-700 font-semibold">
                              ₹{item.amount?.toLocaleString("en-IN")}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">Work</p>
                            <p className="text-gray-600">{item.todayWork}</p>
                          </div>
                        </div>

                        {item.description && (
                          <div className="mb-2">
                            <p className="font-medium text-gray-800">
                              Description
                            </p>
                            <p className="text-gray-600">{item.description}</p>
                          </div>
                        )}

                        {(item.locationFiles?.length > 0 ||
                          item.paymentFiles?.length > 0 ||
                          item.invoiceFiles?.length > 0) && (
                          <div className="mt-3 pt-2 border-t">
                            <p className="font-medium text-gray-800 mb-2">
                              Attachments:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ...(item.locationFiles || []),
                                ...(item.paymentFiles || []),
                                ...(item.invoiceFiles || []),
                              ].map((file, fileIndex) => (
                                <span
                                  key={fileIndex}
                                  className="text-blue-600 text-sm break-all"
                                >
                                  {file}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}

          <div className="mt-8 pt-6 border-t">
            <div className="grid grid-cols-2 max-w-md">
              <p className="text-xl font-semibold">Total Amount:</p>
              <p className="text-xl font-bold text-violet-800 text-right">
                ₹{totalAmount.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RowData2Pdf;
