import React, { useEffect, useRef, useState } from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf
} from '@react-pdf/renderer';

// PDF Styles
const styles = StyleSheet.create({
  page: { padding: 20, flexDirection: 'column' },
  title: { 
    fontSize: 16, 
    marginBottom: 10, 
    fontWeight: 'bold', 
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  table: { 
    display: 'flex', 
    width: '100%', 
    borderStyle: 'solid', 
    borderWidth: 1 
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  cell: {
    flex: 1,
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    textAlign: 'center',
    justifyContent: 'center',
    textTransform: 'uppercase'
  },
  header: {
    fontWeight: 'bold',
    backgroundColor: '#eee',
    textTransform: 'uppercase'
  },
});

const ExpenseTable = ({ data }: { data: any[] }) => {
  const headers = ['User', 'Expense Type', ...Object.keys(data[0]).filter(k => Array.isArray(data[0][k]))];

  const getAverage = (items: any[]) => {
    if (!items.length) return '0.00';
    const sum = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return (sum / items.length).toFixed(2);
  };

  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.header]}>
        {headers.map((h, i) => (
          <Text style={[styles.cell, { borderRightWidth: i === headers.length - 1 ? 0 : 1 }]} key={i}>
            {h}
          </Text>
        ))}
      </View>
      {data.map((item, i) => (
        <View style={styles.row} key={i}>
          <Text style={styles.cell}>{item.user?.name}</Text>
          <Text style={styles.cell}>{item.expenseType}</Text>
          {headers.slice(2).map((cat, j) => (
            <Text style={[styles.cell, { 
              borderRightWidth: j === headers.slice(2).length - 1 ? 0 : 1,
              textTransform: 'none' 
            }]} key={j}>
              {getAverage(item[cat])}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

const ExpensePDFDocument = ({ data }: { data: any[] }) => (
  <Document>
    <Page size="A3" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>User Expenses Limit Report</Text>
      <ExpenseTable data={data} />
    </Page>
  </Document>
);

export const ExpensePDFDownload = ({ data }: { data: any[] }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const hasDownloaded = useRef(false);

  useEffect(()=>{
  const handleDownload = async () => {
    if (hasDownloaded.current) return;
    setIsGenerating(true);
    try {
      const blob = await pdf(<ExpensePDFDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'expenses_report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      hasDownloaded.current = true;
    } finally {
      setIsGenerating(false);
    }
  };
  handleDownload()
},[data])
  return (
null
  );
};