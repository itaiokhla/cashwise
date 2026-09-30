import React from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { RiDownload2Fill } from "react-icons/ri";

type ExpensesDownloadProp = {
  officeData: any[];
  travelData: any[];
};

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  section: {
    marginBottom: 15,
  },
  categoryHeader: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    fontWeight: "bold",
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    textAlign: "right",
  },
});

// PDF Document Component
const ExpenseDocument = ({ officeData, travelData }: ExpensesDownloadProp) => {
  const flattenData = (data: any[]) => {
    return data.reduce((acc, entry) => {
      Object.keys(entry).forEach((key) => {
        if (Array.isArray(entry[key])) {
          acc[key] = [...(acc[key] || []), ...entry[key]];
        }
      });
      return acc;
    }, {} as { [key: string]: any[] });
  };

  const calculateTotals = (data: { [key: string]: any[] }) => {
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = data[key].reduce((sum, item) => sum + (item.amount || 0), 0);
      return acc;
    }, {} as { [key: string]: number });
  };

  const officeItems = flattenData(officeData);
  const travelItems = flattenData(travelData);

  const officeTotals = calculateTotals(officeItems);
  const travelTotals = calculateTotals(travelItems);

  const grandTotal = [
    ...Object.values(officeTotals),
    ...Object.values(travelTotals),
  ].reduce((sum, val) => sum + val, 0);

  const formatCategoryName = (name: string) => {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/\d+$/, " $&")
      .replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Expense Report</Text>

        {/* Office Expenses */}
        {Object.entries(officeItems).some(
          ([_, items]: [any, any]) => items.length > 0
        ) && (
          <>
            <Text style={styles.categoryHeader}>Office Expenses</Text>
            {Object.entries(officeItems).map(
              ([category, items]: [any, any]) =>
                items.length > 0 && (
                  <View key={category} style={styles.section}>
                    <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
                      {formatCategoryName(category)}
                    </Text>
                    {items.map((item: any, index: number) => (
                      <View key={index} style={styles.row}>
                        <Text>Site Name: {item.siteName}</Text>
                        <Text>Work: {item.todayWork}</Text>
                        <Text>Description: {item.description || "N/A"}</Text>
                        <Text>Amount: ₹{item.amount}</Text>
                      </View>
                    ))}
                    <View style={styles.totalRow}>
                      <Text>Total:</Text>
                      <Text>₹{officeTotals[category]}</Text>
                    </View>
                  </View>
                )
            )}
          </>
        )}

        {/* Travel Expenses */}
        {Object.entries(travelItems).some(
          ([_, items]: [any, any]) => items.length > 0
        ) && (
          <>
            <Text style={styles.categoryHeader}>Travel Expenses</Text>
            {Object.entries(travelItems).map(
              ([category, items]: [any, any]) =>
                items.length > 0 && (
                  <View key={category} style={styles.section}>
                    <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
                      {formatCategoryName(category)}
                    </Text>
                    {items.map((item: any, index: number) => (
                      <View key={index} style={styles.row}>
                        <Text>Site Name: {item.siteName}</Text>
                        <Text>Work: {item.todayWork}</Text>
                        <Text>Description: {item.description || "N/A"}</Text>
                        <Text>Amount: ₹{item.amount}</Text>
                      </View>
                    ))}
                    <View style={styles.totalRow}>
                      <Text>Total:</Text>
                      <Text>₹{travelTotals[category]}</Text>
                    </View>
                  </View>
                )
            )}
          </>
        )}

        <View style={styles.grandTotal}>
          <Text>Grand Total: ₹{grandTotal}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default function ExpensesDownload({
  officeData,
  travelData,
}: ExpensesDownloadProp) {
  return (
    <div className="mb-4">
      <PDFDownloadLink
        document={
          <ExpenseDocument officeData={officeData} travelData={travelData} />
        }
        fileName="expenses_report.pdf"
        className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded whitespace-nowrap"
      >
        {({ loading }) => (loading ? "Generating PDF..." : "Download Report")}
      </PDFDownloadLink>
    </div>
  );
}
