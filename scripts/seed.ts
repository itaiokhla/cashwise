import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import Users from "../app/_model/user.model";
import Site from "../app/_model/site.modal";
import ExpenseLimit, { DEFAULT_EXPENSE_LIMITS } from "../app/_model/expenseLimit.modal";
import TravelExpense from "../app/_model/travel.modal";
import OfficeExpense from "../app/_model/office.modal";
import ToPayExpense from "../app/_model/toPay.modal";
import ScheduledReport from "../app/_model/scheduledReport.model";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cashwise";

async function runSeed() {
  console.log("==================================================");
  console.log("🌱 CASHWISE DATABASE SEED SCRIPT");
  console.log(`📡 Connecting to MongoDB at: ${MONGODB_URI}`);
  console.log("==================================================");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully.");

  // 1. Clean existing records (Idempotent)
  console.log("\n🧹 Cleaning existing collections...");
  await Promise.all([
    Users.deleteMany({}),
    Site.deleteMany({}),
    ExpenseLimit.deleteMany({}),
    TravelExpense.deleteMany({}),
    OfficeExpense.deleteMany({}),
    ToPayExpense.deleteMany({}),
    ScheduledReport.deleteMany({}),
  ]);
  console.log("Existing collections cleared.");

  // 2. Create Users
  console.log("\n👤 Seeding Users with bcrypt encrypted passwords...");
  const hashedPassword = await bcrypt.hash("Cashwise@123", 10);

  const rawUsers = [
    {
      name: "System Admin",
      email: "admin@intertech.com",
      password: hashedPassword,
      role: "admin",
      phone: 9876543210,
      type: "employee",
    },
    {
      name: "Finance Manager",
      email: "manager@intertech.com",
      password: hashedPassword,
      role: "manager",
      phone: 9876543211,
      type: "employee",
    },
    {
      name: "Rahul Sharma",
      email: "rahul.sharma@intertech.com",
      password: hashedPassword,
      role: "employee",
      phone: 9876543212,
      type: "employee",
    },
    {
      name: "Priya Verma",
      email: "priya.verma@intertech.com",
      password: hashedPassword,
      role: "employee",
      phone: 9876543213,
      type: "employee",
    },
    {
      name: "Amit Kumar",
      email: "amit.kumar@intertech.com",
      password: hashedPassword,
      role: "employee",
      phone: 9876543214,
      type: "employee",
    },
    {
      name: "Suresh Patel (ToPay)",
      email: "topay@intertech.com",
      password: hashedPassword,
      role: "toPay",
      phone: 9876543215,
      type: "employee",
    },
  ];

  const createdUsers = await Users.insertMany(rawUsers);
  console.log(`Created ${createdUsers.length} users.`);

  const adminUser = createdUsers.find((u) => u.role === "admin")!;
  const employees = createdUsers.filter((u) => u.role === "employee");
  const toPayUser = createdUsers.find((u) => u.role === "toPay")!;

  // 3. Create Sites
  console.log("\n🏢 Seeding Construction & Office Sites...");
  const siteData = [
    { name: "Connaught Place HQ", address: "Barakhamba Road, Connaught Place, New Delhi", status: "active" },
    { name: "Noida Sector 62 Tech Park", address: "C-Block, Industrial Area, Sector 62, Noida", status: "active" },
    { name: "Gurugram Cyber Hub Site", address: "DLF Cyber City, Phase 2, Gurugram", status: "active" },
    { name: "Mumbai Nariman Point Office", address: "Maker Chambers, Nariman Point, Mumbai", status: "active" },
    { name: "Bengaluru Whitefield Facility", address: "ITPL Main Road, Whitefield, Bengaluru", status: "active" },
  ];

  const createdSites = await Site.insertMany(siteData);
  console.log(`Created ${createdSites.length} sites.`);

  // 4. Create Expense Limits for all users
  console.log("\n💰 Seeding Expense Limits...");
  const limitsData = createdUsers.map((user) => ({
    name: user.name,
    userId: user._id,
    createdBy: adminUser._id,
    ...DEFAULT_EXPENSE_LIMITS,
    status: "Active",
  }));
  await ExpenseLimit.insertMany(limitsData);
  console.log(`Created ${limitsData.length} expense limits.`);

  // 5. Generate Realistic Expenses across last 30 days
  console.log("\n📊 Generating realistic Travel, Office, and ToPay Expenses...");

  const statuses = ["approved", "approved", "approved", "pending", "rejected"];
  const getStatus = () => statuses[Math.floor(Math.random() * statuses.length)];
  const getRandomSite = () => createdSites[Math.floor(Math.random() * createdSites.length)].name;
  const getRandomEmp = () => employees[Math.floor(Math.random() * employees.length)];

  const getDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  const travelExpenses = [];
  const officeExpenses = [];
  const toPayExpenses = [];

  for (let day = 0; day < 30; day++) {
    const date = getDateStr(day);

    // Travel expenses
    for (let i = 0; i < (day % 2 === 0 ? 2 : 1); i++) {
      const emp = getRandomEmp();
      const site = getRandomSite();
      travelExpenses.push({
        date,
        createdBy: emp._id,
        conveyance: [
          {
            siteName: site,
            todayWork: "Client inspection & site audit",
            location: { latitude: 28.6139, longitude: 77.209, address: site },
            amount: 250 + Math.floor(Math.random() * 450),
            status: getStatus(),
            modeOfTravel: Math.random() > 0.5 ? "Metro" : "Cab",
            startingPlace: "Head Office",
            endingPlace: site,
            driverNumber: 9811223344,
            description: "Site commute for audit",
          },
        ],
        food: [
          {
            siteName: site,
            todayWork: "On-site supervisor meal",
            location: { latitude: 28.6139, longitude: 77.209, address: site },
            amount: 180 + Math.floor(Math.random() * 320),
            status: getStatus(),
            meal: "Lunch",
            numberOfPersons: 2,
            restaurantName: "Bikanervala Express",
            restaurantNumber: 9811002233,
            description: "Lunch during site survey",
          },
        ],
        tea: [
          {
            siteName: site,
            todayWork: "Tea & refreshments for site staff",
            location: { latitude: 28.6139, longitude: 77.209, address: site },
            amount: 40 + Math.floor(Math.random() * 60),
            status: "approved",
            meal: "Tea/Snacks",
            numberOfPersons: 3,
            description: "Evening tea at client site",
          },
        ],
        courier:
          day % 4 === 0
            ? [
                {
                  siteName: site,
                  todayWork: "Blueprints dispatch",
                  location: { latitude: 28.6139, longitude: 77.209, address: site },
                  amount: 120,
                  status: "approved",
                  customerName: "Blue Dart Express",
                  deliveryMode: "Air Express",
                  packetType: "Engineering Drawings",
                  startingPlace: "Connaught Place HQ",
                  endingPlace: site,
                  description: "Drawings sent for review",
                },
              ]
            : [],
      });
    }

    // Office expenses
    for (let j = 0; j < (day % 3 === 0 ? 2 : 1); j++) {
      const emp = getRandomEmp();
      const site = getRandomSite();
      officeExpenses.push({
        date,
        createdBy: emp._id,
        purchase: [
          {
            siteName: site,
            todayWork: "Office stationery & supplies",
            location: { latitude: 28.5355, longitude: 77.391, address: site },
            amount: 600 + Math.floor(Math.random() * 1400),
            status: getStatus(),
            itemName: "Stationery / Paper reams / Printer Ink",
            quantity: 4,
            shopName: "National Stationery Mart",
            shopNumber: 9812345670,
            description: "Printer paper and ink cartridges",
          },
        ],
        maintenance:
          day % 5 === 0
            ? [
                {
                  siteName: site,
                  todayWork: "HVAC and AC servicing",
                  location: { latitude: 28.5355, longitude: 77.391, address: site },
                  amount: 1500,
                  status: getStatus(),
                  jobName: "AC Filter Servicing",
                  person: "Cool Air Services",
                  numberOfPerson: 2,
                  nameOfItem: "AC Gas & Filter cleaning",
                  totalLabour: 500,
                  description: "Server room AC maintenance",
                },
              ]
            : [],
        labour:
          day % 3 === 0
            ? [
                {
                  siteName: site,
                  todayWork: "Archive room shifting",
                  location: { latitude: 28.5355, longitude: 77.391, address: site },
                  amount: 800,
                  status: "approved",
                  purposeOfLabour: "Storage reorganization",
                  masterLabourName: "Ram Singh",
                  numberOfLabours: 2,
                  description: "Document storage shifting",
                },
              ]
            : [],
      });
    }

    // ToPay expenses
    if (day % 2 === 0) {
      const site = getRandomSite();
      toPayExpenses.push({
        date,
        createdBy: toPayUser._id,
        contractor: [
          {
            siteName: site,
            todayWork: "Electrical subcontracting payment",
            location: { latitude: 28.4595, longitude: 77.0266, address: site },
            amount: 3500 + Math.floor(Math.random() * 5000),
            status: getStatus(),
            serviceProvider: "Shree Ganesh Electricals",
            documentNo: `BILL-${1000 + day}`,
            description: "Milestone payment for electrical panel wiring",
          },
        ],
        purchase: [
          {
            siteName: site,
            todayWork: "Bulk electrical switches and PVC conduit",
            location: { latitude: 28.4595, longitude: 77.0266, address: site },
            amount: 2200 + Math.floor(Math.random() * 1800),
            status: getStatus(),
            itemName: "Schneider Modular Switches",
            quantity: 50,
            shopName: "Havells Wholesale Hub",
            shopNumber: 9899112233,
            description: "Bulk modular switches for site renovation",
          },
        ],
      });
    }
  }

  await TravelExpense.insertMany(travelExpenses);
  await OfficeExpense.insertMany(officeExpenses);
  await ToPayExpense.insertMany(toPayExpenses);

  console.log(`Created ${travelExpenses.length} Travel Expense entries.`);
  console.log(`Created ${officeExpenses.length} Office Expense entries.`);
  console.log(`Created ${toPayExpenses.length} ToPay Expense entries.`);

  // 6. Create Initial Scheduled Report Configuration
  console.log("\n⏰ Creating Scheduled Report Configuration...");
  const scheduledReport = await ScheduledReport.create({
    reportType: "expense",
    frequency: "daily",
    time: "09:00",
    timezone: "Asia/Kolkata",
    recipients: ["itofficepulse@gmail.com", "admin@intertech.com"],
    reportPeriod: "all",
    enabled: true,
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
    nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  console.log(`Created Scheduled Report: ID ${scheduledReport._id}`);

  // Summary
  console.log("\n==================================================");
  console.log("🎉 SEEDING COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
  console.log("\n🔑 TEST LOGIN CREDENTIALS:");
  console.log("Password for all accounts: Cashwise@123\n");
  console.log("1. Admin:    admin@intertech.com        (Phone: 9876543210)");
  console.log("2. Manager:  manager@intertech.com      (Phone: 9876543211)");
  console.log("3. Employee: rahul.sharma@intertech.com (Phone: 9876543212)");
  console.log("4. Employee: priya.verma@intertech.com  (Phone: 9876543213)");
  console.log("5. Employee: amit.kumar@intertech.com   (Phone: 9876543214)");
  console.log("6. ToPay:    topay@intertech.com        (Phone: 9876543215)");
  console.log("\n==================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Seed failed with error:", err);
  process.exit(1);
});
