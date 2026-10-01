import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import Users from "../app/_model/user.model";
import Site from "../app/_model/site.modal";
import ExpenseLimit, { DEFAULT_EXPENSE_LIMITS } from "../app/_model/expenseLimit.modal";
import TravelExpense from "../app/_model/travel.modal";
import OfficeExpense from "../app/_model/office.modal";
import ToPayExpense from "../app/_model/toPay.modal";
import Group from "../app/_model/group.modal";
import DataWithDate from "../app/_model/datawithdate.modal";
import Ledger from "../app/_model/ledger.schema";
import JournalVoucher from "../app/_model/journalVoucher.schema";
import PaymentVoucher from "../app/_model/paymentVoucher.schema";
import ScheduledReport from "../app/_model/scheduledReport.model";
import ReportExecution from "../app/_model/reportExecution.model";
import ReportShareLink, { generateShareToken } from "../app/_model/reportShareLink.model";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cashwise";
const SEED_TAG = "cashwise-e2e-v2";
const PASSWORD = "Cashwise@123";
const CATEGORIES = [
  "conveyance", "purchase", "food", "tea", "hotel", "labour", "courier", "loading",
  "porter", "cartage", "rider", "dailyWages", "transport", "maintenance", "other",
] as const;
const STATUSES = ["approved", "pending", "rejected"] as const;
const INDIAN_NAMES = [
  "Aarav Sharma", "Diya Patel", "Arjun Singh", "Meera Iyer", "Kabir Gupta",
  "Ananya Verma", "Rohan Desai", "Ishita Nair", "Vikram Rao", "Sanya Kapoor",
  "Aditya Joshi", "Kavya Reddy", "Rahul Mehta", "Pooja Mishra", "Nikhil Bansal",
  "Neha Kulkarni", "Siddharth Jain", "Riya Chatterjee", "Manish Yadav", "Simran Kaur",
];
const ROLE_CONFIG = [
  { role: "admin", prefix: "admin", start: 0 },
  { role: "manager", prefix: "manager", start: 5 },
  { role: "employee", prefix: "employee", start: 10 },
  { role: "toPay", prefix: "topay", start: 15 },
] as const;
const SITE_DATA = [
  ["Delhi Connaught Place HQ", "Barakhamba Road, Connaught Place, New Delhi", 28.6315, 77.2167],
  ["Noida Sector 62 Tech Park", "C Block, Sector 62, Noida, Uttar Pradesh", 28.6273, 77.3722],
  ["Gurugram Cyber City", "DLF Cyber City, Gurugram, Haryana", 28.4949, 77.0890],
  ["Mumbai Andheri Office", "Andheri East, Mumbai, Maharashtra", 19.1136, 72.8697],
  ["Bengaluru Whitefield Site", "ITPL Main Road, Whitefield, Bengaluru, Karnataka", 12.9698, 77.7500],
  ["Pune Hinjawadi Project", "Rajiv Gandhi Infotech Park, Hinjawadi, Pune", 18.5912, 73.7389],
  ["Hyderabad HITEC City", "Madhapur, Hyderabad, Telangana", 17.4435, 78.3772],
  ["Chennai Guindy Branch", "Guindy Industrial Estate, Chennai, Tamil Nadu", 13.0067, 80.2206],
] as const;

function dateDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(10, 30, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function isoDate(days: number): string {
  return dateDaysAgo(days).toISOString().slice(0, 10);
}

function transaction(partyName: string, partyEmail: string, partyPhone: number, index: number, kind: "credit" | "debit") {
  return {
    name: partyName,
    email: partyEmail,
    phone: String(partyPhone),
    transactionDetails: [0, 1, 2].map((n) => ({
      transactionId: `${SEED_TAG}-${kind}-${index + 1}-${n + 1}`,
      tallyEntry: n === 0 ? "Synced" : "Not Synced",
      money: (kind === "credit" ? 12500 : 2350) + index * 425 + n * 775,
      reason: kind === "credit" ? ["Project advance", "Travel float", "Office imprest"][n] : ["Office supplies", "Client travel", "Site refreshments"][n],
      remarks: `${kind === "credit" ? "Received from" : "Paid to"} ${partyName} via ${["UPI", "NEFT", "Cash"][n]}`,
      imageUrl: [],
      createdAt: dateDaysAgo(index * 5 + n * 17),
      updatedAt: dateDaysAgo(index * 5 + n * 17),
    })),
  };
}

function commonExpense(category: string, userIndex: number, categoryIndex: number, source: string) {
  const site = SITE_DATA[(userIndex + categoryIndex) % SITE_DATA.length];
  const status = STATUSES[(userIndex + categoryIndex) % STATUSES.length];
  return {
    siteName: site[0],
    todayWork: `${source} ${category} work and verification`,
    location: { latitude: site[2], longitude: site[3], address: site[1] },
    amount: 150 + categoryIndex * 375 + userIndex * 85,
    description: `${category} expense for ${site[0]} - GST invoice verified`,
    ledgerType: `${category[0].toUpperCase()}${category.slice(1)} Expenses`,
    remarks: `${["UPI", "Cash", "NEFT"][categoryIndex % 3]} payment; seeded for filter testing`,
    tallyEntry: categoryIndex % 2 ? "Not Synced" : "Synced",
    adminMessage: status === "rejected" ? "Please attach clearer supporting bill" : "",
    status,
    serviceProvider: ["Bharat Services", "Shree Ganesh Enterprises", "Sai Solutions"][categoryIndex % 3],
    locationFiles: [], paymentFiles: [], invoiceFiles: [],
    createdAt: dateDaysAgo(userIndex * 4 + categoryIndex * 7),
    updatedAt: dateDaysAgo(userIndex * 4 + categoryIndex * 7),
  };
}

function categoryExpense(category: typeof CATEGORIES[number], userIndex: number, categoryIndex: number, source: string) {
  const base = commonExpense(category, userIndex, categoryIndex, source);
  const site = base.siteName;
  switch (category) {
    case "conveyance": return { ...base, modeOfTravel: ["Metro", "Auto", "Cab"][userIndex % 3], startingPlace: "Regional Office", endingPlace: site, driverNumber: 9811001000 + userIndex };
    case "purchase": return { ...base, itemName: "Electrical fittings and stationery", quantity: 2 + userIndex, shopName: "Bharat Traders", shopNumber: 9822002000 + userIndex };
    case "food": return { ...base, meal: "Lunch", numberOfPersons: 2 + userIndex % 4, restaurantName: "Haldiram's", restaurantNumber: 9833003000 + userIndex };
    case "tea": return { ...base, meal: "Tea and snacks", numberOfPersons: 3 + userIndex % 5 };
    case "hotel": return { ...base, hotelName: "Ginger Business Hotel", hotelNumber: 9844004000 + userIndex, documentNo: `HTL-${1000 + userIndex}`, numberOfPersons: 2, rent: base.amount, days: 2, startingDate: dateDaysAgo(categoryIndex * 7 + 2), endingDate: dateDaysAgo(categoryIndex * 7) };
    case "labour": return source === "toPay"
      ? { ...base, serviceProvider: "Shakti Labour Services", documentNo: `LAB-${1000 + userIndex}`, labourDetails: [{ type: "Skilled", numberOfLabour: 3, rate: 850 }], fromDate: dateDaysAgo(12), toDate: dateDaysAgo(10), paymentDate: dateDaysAgo(9) }
      : { ...base, purposeOfLabour: "Material shifting and installation", documentNo: `LAB-${1000 + userIndex}`, masterLabourName: "Ramesh Kumar", masterLabourNumber: 9855005000 + userIndex, numberOfLabours: 3 };
    case "courier": return { ...base, customerName: "Blue Dart Express", deliveryMode: "Surface", packetType: "Project documents", startingPlace: "Head Office", endingPlace: site };
    case "loading": return { ...base, workType: "Loading and unloading", material: "Electrical panels", documentNo: `LD-${1000 + userIndex}`, masterLabourName: "Mohan Lal", loadingDetails: [{ type: "Panel", quantity: 4, rate: 550 }] };
    case "porter": case "cartage": case "transport": return { ...base, customerName: "Agarwal Logistics", purpose: "Material movement", documentNo: `TR-${categoryIndex}-${userIndex}`, documentType: "E-way bill", vehicleType: "Tata Ace", startingPlace: "Warehouse", distance: `${18 + userIndex} km`, endingPlace: site, driverNumber: 9866006000 + userIndex };
    case "rider": return { ...base, customerName: "Delhivery", deliveryMode: "Motorcycle", startingPlace: "Branch Office", endingPlace: site };
    case "dailyWages": return source === "toPay"
      ? { ...base, serviceProvider: "Shakti Labour Services", documentNo: `DW-${1000 + userIndex}`, labourDetails: [{ type: "Helper", numberOfLabour: 2, rate: 650 }], fromDate: dateDaysAgo(5), toDate: dateDaysAgo(4), paymentDate: dateDaysAgo(3) }
      : { ...base, purposeOfLabour: "Daily site assistance", documentNo: `DW-${1000 + userIndex}`, masterLabourName: "Suresh Yadav", masterLabourNumber: 9877007000 + userIndex, numberOfLabours: 2 };
    case "maintenance": return { ...base, jobName: "AC and electrical maintenance", person: "Cool Care Services", documentNo: `MNT-${1000 + userIndex}`, numberOfPerson: 2, nameOfItem: "AC filter and wiring", totalLabour: 900 };
    case "other": return { ...base, nameOfPerson: "Local Municipal Vendor", contactNumber: 9888008000 + userIndex, documentNo: `OTH-${1000 + userIndex}` };
  }
}

function expenseDocument(userId: mongoose.Types.ObjectId, userIndex: number, source: "office" | "travel" | "toPay") {
  const doc: Record<string, unknown> = { date: isoDate(userIndex * 6), createdBy: userId };
  CATEGORIES.forEach((category, categoryIndex) => { doc[category] = [categoryExpense(category, userIndex, categoryIndex, source)]; });
  if (source === "toPay") {
    const base = commonExpense("contractor", userIndex, 15, source);
    doc.contractor = [{ ...base, serviceProvider: "Om Sai Electrical Contractors", documentNo: `CON-${1000 + userIndex}`, contractorDetails: [{ type: "Wiring point", quantity: 20, rate: 450 }], fromDate: dateDaysAgo(30), toDate: dateDaysAgo(2), paymentDate: dateDaysAgo(1) }];
  }
  return doc;
}

async function cleanupSeedData() {
  const oldUsers = await Users.find({ email: /^(admin|manager|employee|topay)[1-5]@cashwise\.test$/ }, { _id: 1 }).lean();
  const ids = oldUsers.map((u) => u._id);
  const schedules = await ScheduledReport.find({ createdBy: { $in: ids } }, { _id: 1 }).lean();
  const scheduleIds = schedules.map((s) => s._id);
  const executions = await ReportExecution.find({ scheduleId: { $in: scheduleIds } }, { _id: 1 }).lean();
  const executionIds = executions.map((e) => e._id);
  await Promise.all([
    ReportShareLink.deleteMany({ $or: [{ scheduleId: { $in: scheduleIds } }, { reportExecutionId: { $in: executionIds } }] }),
    ReportExecution.deleteMany({ scheduleId: { $in: scheduleIds } }), ScheduledReport.deleteMany({ createdBy: { $in: ids } }),
    JournalVoucher.deleteMany({ userId: { $in: ids } }), PaymentVoucher.deleteMany({ userId: { $in: ids } }),
    Ledger.deleteMany({ userId: { $in: ids } }), Group.deleteMany({ createdBy: { $in: ids } }),
    ExpenseLimit.deleteMany({ userId: { $in: ids } }), TravelExpense.deleteMany({ createdBy: { $in: ids } }),
    OfficeExpense.deleteMany({ createdBy: { $in: ids } }), ToPayExpense.deleteMany({ createdBy: { $in: ids } }),
    Users.deleteMany({ _id: { $in: ids } }), Site.deleteMany({ createdBy: SEED_TAG }),
  ]);
}

async function runSeed() {
  console.log(`Connecting to ${MONGODB_URI.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")}`);
  await mongoose.connect(MONGODB_URI);
  await cleanupSeedData();

  const password = await bcrypt.hash(PASSWORD, 10);
  const rawUsers = ROLE_CONFIG.flatMap(({ role, prefix, start }) => Array.from({ length: 5 }, (_, i) => {
    const index = start + i;
    const peer = (index + 1) % INDIAN_NAMES.length;
    return {
      name: INDIAN_NAMES[index], email: `${prefix}${i + 1}@cashwise.test`, password, role,
      phone: 9000000001 + index, type: index % 2 ? "contractor" : "employee",
      credit: [transaction(INDIAN_NAMES[peer], `${ROLE_CONFIG[(index + 1) % 4].prefix}1@cashwise.test`, 9000000001 + peer, index, "credit")],
      debit: [transaction(INDIAN_NAMES[peer], `${ROLE_CONFIG[(index + 1) % 4].prefix}1@cashwise.test`, 9000000001 + peer, index, "debit")],
    };
  }));
  const users: any[] = await Users.insertMany(rawUsers);
  const admin = users.find((u) => u.role === "admin");

  const sites = await Site.insertMany(SITE_DATA.map(([name, address]) => ({ name, address, status: "active", createdBy: SEED_TAG })));
  await ExpenseLimit.insertMany(users.map((u, i) => ({
    name: u.name, userId: u._id, createdBy: admin._id, ...DEFAULT_EXPENSE_LIMITS,
    max_limit: 6000 + i * 500, status: ["Active", "Active", "In-Active", "Blocked"][i % 4],
  })));

  const officeOwners = users.filter((u) => u.role !== "toPay");
  const toPayOwners = users.filter((u) => u.role === "toPay");
  const officeDocs = await OfficeExpense.insertMany(officeOwners.map((u, i) => expenseDocument(u._id, i, "office")));
  const travelDocs = await TravelExpense.insertMany(officeOwners.map((u, i) => expenseDocument(u._id, i + 3, "travel")));
  const toPayDocs = await ToPayExpense.insertMany(toPayOwners.map((u, i) => expenseDocument(u._id, i + 6, "toPay")));
  for (let i = 0; i < officeOwners.length; i++) {
    await Users.updateOne({ _id: officeOwners[i]._id }, { $set: { expense: [officeDocs[i]._id, travelDocs[i]._id] } });
  }
  for (let i = 0; i < toPayOwners.length; i++) await Users.updateOne({ _id: toPayOwners[i]._id }, { $set: { expense: [toPayDocs[i]._id] } });

  await Group.insertMany([
    { name: "North India Operations", members: users.slice(0, 10).map((u) => ({ user: u._id, role: u.role })), createdBy: admin._id },
    { name: "Project Expense Team", members: users.slice(10).map((u) => ({ user: u._id, role: u.role })), createdBy: admin._id },
  ]);
  await DataWithDate.findOneAndUpdate({ fromDate: dateDaysAgo(365), toDate: dateDaysAgo(0) }, { fromDate: dateDaysAgo(365), toDate: dateDaysAgo(0) }, { upsert: true });

  const ledgerTemplates = [
    ["Cashwise Test ICICI Bank", "Bank Accounts", "Cr"], ["Cashwise Test Travel Expenses", "Indirect Expenses", "Dr"],
    ["Cashwise Test Office Expenses", "Indirect Expenses", "Dr"], ["Cashwise Test Om Sai Contractors", "Sundry Creditors", "Cr"],
  ] as const;
  const ledgers: any[] = await Ledger.insertMany(ledgerTemplates.map(([ledgerName, groupName, drCr], i) => ({
    ledgerName, groupName, creditPeriod: i * 7, address: { addressLine1: SITE_DATA[i][1], country: "India", state: ["Delhi", "Uttar Pradesh", "Haryana", "Maharashtra"][i], pincode: ["110001", "201301", "122002", "400069"][i] },
    contactDetails: { contactPerson: INDIAN_NAMES[i], phoneNo: String(9111100000 + i), mobileNo: String(9222200000 + i), email: `ledger${i + 1}@cashwise.test`, website: "https://example.test" },
    taxDetails: { panNo: `ABCDE${1000 + i}F`, gstin: [`07ABCDE1000F1Z5`, `09ABCDE1001F1Z3`, `06ABCDE1002F1Z7`, `27ABCDE1003F1Z2`][i], gstRegType: "Regular" },
    openingBalance: { amount: 10000 + i * 2500, drCr, billName: `OPEN-${i + 1}`, billDate: dateDaysAgo(365) }, currentBalance: 10000 + i * 2500,
    isActive: i !== 3, tallyIntegration: i % 2 === 0, tallyIntegrationDate: i % 2 === 0 ? dateDaysAgo(2) : null, userId: admin._id,
  })));

  const journalVouchers = [];
  const paymentVouchers = [];
  for (let i = 0; i < 6; i++) {
    const amount = 2500 + i * 750;
    journalVouchers.push(await JournalVoucher.create({ voucherNumber: `CW-JV-${String(i + 1).padStart(4, "0")}`, date: dateDaysAgo(i * 18), entries: [
      { ledgerName: ledgers[1].ledgerName, ledgerId: ledgers[1]._id, debitCredit: "Dr", amount, description: "Travel expense booked for project visit" },
      { ledgerName: ledgers[3].ledgerName, ledgerId: ledgers[3]._id, debitCredit: "Cr", amount, remarks: "Payable to Indian service provider" },
    ], narration: `Travel expense adjustment ${i + 1}`, totalAmount: amount, userId: admin._id, status: ["Posted", "Draft", "Voucher created"][i % 3], tallyIntegration: i % 2 === 0 }));
    paymentVouchers.push(await PaymentVoucher.create({ voucherNumber: `CW-PV-${String(i + 1).padStart(4, "0")}`, date: dateDaysAgo(i * 14), cashBankLedgerName: ledgers[0].ledgerName, cashBankLedgerId: ledgers[0]._id, instrumentType: ["UPI", "NEFT", "Cash"][i % 3], instrumentNumber: `UTR-CW-${10000 + i}`, instrumentDate: dateDaysAgo(i * 14), entries: [
      { ledgerName: ledgers[2].ledgerName, ledgerId: ledgers[2]._id, debitCredit: "Dr", amount, description: "Office operational payment", billName: `INV-${2000 + i}`, costCenter: SITE_DATA[i % SITE_DATA.length][0] },
      { ledgerName: ledgers[0].ledgerName, ledgerId: ledgers[0]._id, debitCredit: "Cr", amount, remarks: "Paid through company bank account" },
    ], narration: `Office payment ${i + 1}`, totalAmount: amount, userId: admin._id, status: ["Posted", "Draft", "Cancelled"][i % 3], tallyIntegration: i % 2 === 0 }));
  }

  const reportEmail = process.env.SEED_REPORT_EMAIL || process.env.AUTO_EXPENSE_REPORT_TO || process.env.EMAIL_USER || "admin@cashwise.test";
  const schedules: any[] = await ScheduledReport.insertMany([
    { name: "Daily Approved Expense Report", reportType: "expense", frequency: "daily", time: "09:00", timezone: "Asia/Kolkata", recipients: [reportEmail], reportPeriod: "daily", enabled: true, filters: { expenseSources: ["office", "travel", "toPay"], statuses: ["approved"], includeCredit: false, includeDebit: false }, nextRunAt: dateDaysAgo(-1), createdBy: admin._id, updatedBy: admin._id },
    { name: "Weekly Combined Finance Report", reportType: "combined", frequency: "weekly", time: "18:30", timezone: "Asia/Kolkata", recipients: [reportEmail], reportPeriod: "weekly", enabled: true, filters: { statuses: ["approved", "pending"], includeCredit: true, includeDebit: true }, nextRunAt: dateDaysAgo(-7), createdBy: admin._id, updatedBy: admin._id },
    { name: "Monthly ToPay Contractor Report", reportType: "toPay", frequency: "monthly", time: "10:00", timezone: "Asia/Kolkata", recipients: [reportEmail], reportPeriod: "monthly", enabled: false, filters: { expenseSources: ["toPay"], categories: ["contractor", "labour", "purchase"], statuses: ["approved", "pending"] }, nextRunAt: dateDaysAgo(-30), createdBy: admin._id, updatedBy: admin._id },
  ]);
  const execution: any = await ReportExecution.create({ scheduleId: schedules[0]._id, executionKey: `${SEED_TAG}:history:1`, reportType: "expense", period: "daily", fromDate: isoDate(1), toDate: isoDate(0), recipients: [reportEmail], recipientCount: 1, recordCount: 15, totalAmount: 28750, status: "success", pdfUrls: [], durationMs: 1240, executedAt: dateDaysAgo(1), triggeredBy: "manual_test" });
  const { rawToken, tokenHash } = generateShareToken();
  const share: any = await ReportShareLink.create({ reportExecutionId: execution._id, scheduleId: schedules[0]._id, tokenHash, expiresAt: dateDaysAgo(-7), snapshotData: { reportType: "expense", fromDate: isoDate(1), toDate: isoDate(0), period: "daily", recordCount: 15, totalAmount: 28750, filters: { statuses: ["approved"] }, summary: { expenseTotal: 28750, creditTotal: 0, debitTotal: 0, grandTotal: 28750, totalRecords: 15, averagePerEntry: 1916.67, byUser: {}, byDate: {}, byCategory: {} }, rows: [], scheduleName: schedules[0].name, timezone: "Asia/Kolkata", recipients: [reportEmail] } });
  await ReportExecution.updateOne({ _id: execution._id }, { shareLinkId: share._id, shareUrl: `/shared-report/${rawToken}`, shareExpiresAt: share.expiresAt });

  console.log("\nSEED COMPLETE");
  console.log(`Users: ${users.length} (5 per role) | Sites: ${sites.length} | Expense documents: ${officeDocs.length + travelDocs.length + toPayDocs.length}`);
  console.log(`Ledgers: ${ledgers.length} | Journal vouchers: ${journalVouchers.length} | Payment vouchers: ${paymentVouchers.length} | Schedules: ${schedules.length}`);
  console.log(`Report recipient: ${reportEmail}`);
  console.log(`Password for every seeded user: ${PASSWORD}`);
  ROLE_CONFIG.forEach(({ role, prefix }) => console.log(`${role}: ${prefix}1@cashwise.test ... ${prefix}5@cashwise.test`));
  console.log(`Sample share path: /shared-report/${rawToken}`);
}

runSeed()
  .catch((error) => { console.error("Seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
