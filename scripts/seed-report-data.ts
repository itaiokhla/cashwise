/**
 * scripts/seed-report-data.ts
 *
 * Bulk test data for the automated reports: expense claims across every
 * expense type and category, cash credits (advances) and the matching debits,
 * spread over many dates and users — so daily / weekly / monthly and
 * per-employee reports have realistic volume.
 *
 * Usage:
 *   npm run seed:reports                          # 8,000 expenses + 2,000 credits = 10,000 records
 *   npm run seed:reports -- --expenses=5000 --credits=1000 --days=90
 *   npm run seed:reports -- --clean               # remove everything this script created
 *
 * Every generated record carries `seedTag: "report-bulk-v1"`, so re-running
 * replaces the previous batch (never duplicates) and --clean removes it
 * without touching real data. Like the app, each expense also books a debit on
 * the employee, so cash-in-hand (credit − debit) stays realistic.
 * A fixed random seed gives the same mix of users, categories and amounts on
 * every run; dates are relative to the day you run it.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { DateTime } from "luxon";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cashwise";
const SEED_TAG = "report-bulk-v1";
const ZONE = "Asia/Kolkata";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const EXPENSE_COUNT = Number(args.expenses ?? 8000);
const CREDIT_COUNT = Number(args.credits ?? 2000);
const DAYS = Number(args.days ?? 120);

// ─── Deterministic random ─────────────────────────────────────────────────────

let rngState = 20261013;
function rand(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
function weighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[entries.length - 1][0];
}

// ─── Reference data ───────────────────────────────────────────────────────────

const SITES = [
  ["Okhla Industrial Estate", "Phase III, Okhla, New Delhi", 28.5355, 77.2735],
  ["Delhi Connaught Place HQ", "Barakhamba Road, New Delhi", 28.6315, 77.2167],
  ["Noida Sector 62 Tech Park", "C Block, Sector 62, Noida", 28.6273, 77.3722],
  ["Gurugram Cyber City", "DLF Cyber City, Gurugram", 28.4949, 77.089],
  ["Faridabad Plant", "Sector 24, Faridabad", 28.3876, 77.3071],
  ["Mumbai Andheri Office", "Andheri East, Mumbai", 19.1136, 72.8697],
  ["Pune Hinjawadi Project", "Hinjawadi Phase 1, Pune", 18.5912, 73.7389],
  ["Jaipur Sitapura Site", "Sitapura Industrial Area, Jaipur", 26.7802, 75.8456],
] as const;

type Source = "office" | "travel" | "toPay";

const CATEGORY_WEIGHTS: Record<Source, Record<string, number>> = {
  office: { conveyance: 14, purchase: 12, food: 12, tea: 16, courier: 7, porter: 4, cartage: 4, rider: 5, transport: 5, loading: 4, labour: 4, dailyWages: 4, maintenance: 6, other: 5 },
  travel: { conveyance: 26, food: 18, tea: 10, hotel: 14, transport: 8, purchase: 6, courier: 3, rider: 4, other: 5, porter: 3, cartage: 3 },
  toPay: { contractor: 18, labour: 16, dailyWages: 14, purchase: 12, transport: 10, loading: 8, cartage: 6, porter: 5, maintenance: 6, other: 5 },
};

const AMOUNT_RANGE: Record<string, [number, number]> = {
  conveyance: [60, 1500], purchase: [250, 18000], food: [120, 2600], tea: [30, 650], hotel: [1200, 8500],
  labour: [1500, 22000], contractor: [6000, 75000], courier: [80, 1400], loading: [500, 6500], porter: [200, 3200],
  cartage: [300, 5500], rider: [100, 1600], dailyWages: [600, 9000], transport: [500, 14000], maintenance: [300, 12000],
  other: [100, 5000],
};

const LABEL: Record<string, string> = {
  conveyance: "Conveyance", purchase: "Purchase", food: "Food", tea: "Tea", hotel: "Hotel", labour: "Labour",
  contractor: "Contractor", courier: "Courier", loading: "Loading", porter: "Porter", cartage: "Cartage", rider: "Rider",
  dailyWages: "Daily Wages", transport: "Transport", maintenance: "Maintenance", other: "Other",
};

const CATEGORY_FIELDS = Object.keys(AMOUNT_RANGE);

function amountFor(category: string): number {
  const [min, max] = AMOUNT_RANGE[category];
  // Skew towards smaller claims, as in real petty-cash data.
  const value = min + Math.pow(rand(), 1.8) * (max - min);
  const step = value > 5000 ? 100 : value > 1000 ? 10 : 5;
  const rounded = Math.round(value / step) * step;
  return rand() < 0.12 ? rounded + 0.5 : rounded; // some paise to exercise decimals
}

function statusFor(date: DateTime, today: DateTime): "approved" | "pending" | "rejected" {
  const age = today.diff(date, "days").days;
  if (age > 14) return weighted({ approved: 86, rejected: 9, pending: 5 });
  if (age > 3) return weighted({ approved: 55, pending: 36, rejected: 9 });
  return weighted({ pending: 72, approved: 22, rejected: 6 });
}

function itemFor(category: string, source: Source, date: DateTime, today: DateTime, at: Date, index: number) {
  const site = pick(SITES);
  const amount = amountFor(category);
  const status = statusFor(date, today);
  const pay = pick(["UPI", "Cash", "NEFT", "Card"]);
  const base = {
    _id: new mongoose.Types.ObjectId(),
    siteName: site[0],
    todayWork: `${LABEL[category]} for ${site[0]}`,
    location: { latitude: site[2], longitude: site[3], address: site[1] },
    amount,
    serviceProvider: "",
    ledgerType: `${LABEL[category]} Expenses`,
    description: "",
    remarks: `${pay} payment`,
    tallyEntry: "",
    adminMessage: status === "rejected" ? pick(["Bill not clear, please re-upload", "Duplicate claim", "Not approved for this site"]) : "",
    status,
    locationFiles: [] as string[],
    paymentFiles: [] as string[],
    invoiceFiles: [] as string[],
    seedTag: SEED_TAG,
    createdAt: at,
    updatedAt: at,
  };
  const n = index % 10000;
  switch (category) {
    case "conveyance": {
      const mode = pick(["Metro", "Auto", "Cab", "Bike", "Bus"]);
      return { ...base, description: `${mode} from ${pick(["Head Office", "Warehouse", "Home", "Client office"])} to ${site[0]}`, modeOfTravel: mode, startingPlace: "Okhla Industrial Estate", endingPlace: site[0], driverNumber: 9811000000 + n };
    }
    case "purchase": {
      const item = pick(["Electrical fittings", "Stationery", "Safety helmets", "Cable ties and tape", "Printer cartridge", "Hardware tools", "Paint and brushes"]);
      return { ...base, description: `${item} for ${site[0]}`, itemName: item, quantity: int(1, 25), shopName: pick(["Bharat Traders", "Gupta Hardware", "Om Electricals", "City Stationers"]), shopNumber: 9822000000 + n };
    }
    case "food": {
      const meal = pick(["Breakfast", "Lunch", "Dinner"]);
      const persons = int(1, 8);
      return { ...base, description: `${meal} for ${persons} at ${site[0]}`, meal, numberOfPersons: persons, restaurantName: pick(["Haldiram's", "Bikanervala", "Saravana Bhavan", "Local dhaba"]), restaurantNumber: 9833000000 + n };
    }
    case "tea": {
      const persons = int(2, 12);
      return { ...base, description: `Tea & snacks for ${persons} people`, meal: "Tea and snacks", numberOfPersons: persons };
    }
    case "hotel": {
      const days = int(1, 3);
      return { ...base, description: `${days} night stay near ${site[0]}`, hotelName: pick(["Ginger Hotel", "Lemon Tree", "OYO Townhouse", "Treebo Trend"]), hotelNumber: 9844000000 + n, documentNo: `HTL-${n}`, numberOfPersons: int(1, 3), rent: amount, days, startingDate: date.minus({ days }).toJSDate(), endingDate: date.toJSDate() };
    }
    case "labour":
      return source === "toPay"
        ? { ...base, description: `Labour payment — ${site[0]}`, serviceProvider: pick(["Shakti Labour Services", "Ram Manpower", "Ganesh Contractors"]), documentNo: `LAB-${n}`, labourDetails: [{ type: pick(["Skilled", "Helper"]), numberOfLabour: int(2, 12), rate: int(6, 12) * 100 }], fromDate: date.minus({ days: 3 }).toJSDate(), toDate: date.toJSDate(), paymentDate: date.toJSDate() }
        : { ...base, description: `Labour for material shifting at ${site[0]}`, purposeOfLabour: "Material shifting and installation", documentNo: `LAB-${n}`, masterLabourName: pick(["Ramesh Kumar", "Mohan Lal", "Suresh Yadav"]), masterLabourNumber: 9855000000 + n, numberOfLabours: int(2, 10) };
    case "contractor":
      return { ...base, description: `Contract work — ${pick(["wiring", "civil", "painting", "plumbing", "HVAC"])} at ${site[0]}`, serviceProvider: pick(["Om Sai Electrical Contractors", "Shree Builders", "Bharat Infra Works"]), documentNo: `CON-${n}`, contractorDetails: [{ type: pick(["Wiring point", "Civil work", "Fixture"]), quantity: int(5, 60), rate: int(2, 12) * 100 }], fromDate: date.minus({ days: 10 }).toJSDate(), toDate: date.toJSDate(), paymentDate: date.toJSDate() };
    case "courier":
      return { ...base, description: `Courier of documents to ${site[0]}`, customerName: pick(["Blue Dart", "DTDC", "Delhivery"]), deliveryMode: pick(["Surface", "Air"]), packetType: "Documents", startingPlace: "Head Office", endingPlace: site[0] };
    case "loading":
      return { ...base, description: `Loading/unloading of material at ${site[0]}`, workType: "Loading and unloading", material: pick(["Electrical panels", "Cement bags", "Steel pipes", "Cable drums"]), documentNo: `LD-${n}`, masterLabourName: "Mohan Lal", loadingDetails: [{ type: "Material", quantity: int(2, 20), rate: int(2, 6) * 100 }] };
    case "porter":
    case "cartage":
    case "transport":
      return { ...base, description: `${LABEL[category]} — warehouse to ${site[0]}`, customerName: pick(["Agarwal Logistics", "Sharma Transport", "VRL"]), purpose: "Material movement", documentNo: `TR-${n}`, documentType: "E-way bill", vehicleType: pick(["Tata Ace", "Pickup", "Tempo", "Truck"]), startingPlace: "Warehouse", distance: `${int(4, 120)} km`, endingPlace: site[0], driverNumber: 9866000000 + n };
    case "rider":
      return { ...base, description: `Rider delivery to ${site[0]}`, customerName: pick(["Delhivery", "Porter", "Dunzo"]), deliveryMode: "Motorcycle", startingPlace: "Branch Office", endingPlace: site[0] };
    case "dailyWages":
      return source === "toPay"
        ? { ...base, description: `Daily wages — ${site[0]}`, serviceProvider: "Shakti Labour Services", documentNo: `DW-${n}`, labourDetails: [{ type: "Helper", numberOfLabour: int(2, 10), rate: int(5, 9) * 100 }], fromDate: date.toJSDate(), toDate: date.toJSDate(), paymentDate: date.toJSDate() }
        : { ...base, description: `Daily site assistance at ${site[0]}`, purposeOfLabour: "Daily site assistance", documentNo: `DW-${n}`, masterLabourName: "Suresh Yadav", masterLabourNumber: 9877000000 + n, numberOfLabours: int(1, 6) };
    case "maintenance":
      return { ...base, description: `${pick(["AC", "Generator", "Electrical", "Plumbing"])} maintenance at ${site[0]}`, jobName: "Maintenance work", person: pick(["Cool Care Services", "Power Fix", "Quick Repairs"]), documentNo: `MNT-${n}`, numberOfPerson: int(1, 4), nameOfItem: pick(["AC filter", "Wiring", "Pump", "DG battery"]), totalLabour: int(2, 15) * 100 };
    default:
      return { ...base, description: pick(["Municipal fee", "Parking charges", "Photocopy and printing", "Site permit fee", "Misc. site expense"]), nameOfPerson: pick(["Local vendor", "Municipal office", "Print shop"]), contactNumber: 9888000000 + n, documentNo: `OTH-${n}` };
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

const COLLECTIONS: Record<Source, string> = { office: "officeexpenses", travel: "travelexpenses", toPay: "topayexpenses" };

async function clean(db: mongoose.mongo.Db) {
  const pull = Object.fromEntries(CATEGORY_FIELDS.map((c) => [c, { seedTag: SEED_TAG }]));
  let removedDocs = 0;
  for (const name of Object.values(COLLECTIONS)) {
    await db.collection(name).updateMany({}, { $pull: pull } as never);
    // Documents this script created and that are now empty go away entirely.
    const empty = await db.collection(name).find({ seedTag: SEED_TAG, $and: CATEGORY_FIELDS.map((c) => ({ $or: [{ [c]: { $exists: false } }, { [c]: { $size: 0 } }] })) }, { projection: { _id: 1 } }).toArray();
    const ids = empty.map((d) => d._id);
    if (ids.length) {
      await db.collection(name).deleteMany({ _id: { $in: ids } });
      await db.collection("users").updateMany({}, { $pull: { expense: { $in: ids } } } as never);
      removedDocs += ids.length;
    }
  }
  await db.collection("users").updateMany({}, { $pull: { credit: { seedTag: SEED_TAG }, debit: { seedTag: SEED_TAG } } } as never);
  return removedDocs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to ${MONGODB_URI.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")}`);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  const removed = await clean(db);
  console.log(`Removed previous "${SEED_TAG}" data (${removed} empty seed documents deleted).`);
  if (args.clean === "true") return;

  const users = await db.collection("users").find({}, { projection: { name: 1, role: 1, phone: 1, email: 1 } }).toArray();
  const spenders = users.filter((u) => u.role === "employee" || u.role === "manager");
  const vendors = users.filter((u) => u.role === "toPay");
  const givers = users.filter((u) => u.role === "admin" || u.role === "manager");
  if (!spenders.length || !vendors.length || !givers.length) {
    throw new Error("Need at least one employee/manager, one toPay and one admin user — run `npm run seed` first.");
  }

  // Some people spend a lot more than others, as in real data.
  const spendWeight = new Map(users.map((u) => [String(u._id), 0.4 + rand() * 2.6]));
  const pickUser = (pool: typeof users) => {
    let r = rand() * pool.reduce((s, u) => s + spendWeight.get(String(u._id))!, 0);
    for (const u of pool) if ((r -= spendWeight.get(String(u._id))!) <= 0) return u;
    return pool[pool.length - 1];
  };

  const now = DateTime.now().setZone(ZONE);
  const today = now.startOf("day");
  const firstDay = today.minus({ days: DAYS - 1 });
  const weekStart = DateTime.max(today.startOf("week"), firstDay);
  const daysIntoWeek = Math.round(today.diff(weekStart, "days").days);
  const randomDay = () => {
    const r = rand();
    // ~3% today and ~7% this week so daily and week-to-date reports always have data.
    if (r < 0.03) return today;
    if (r < 0.1) return weekStart.plus({ days: int(0, daysIntoWeek) });
    return firstDay.plus({ days: int(0, DAYS - 1) });
  };
  const randomTime = (day: DateTime) => {
    const at = day.set({ hour: int(8, 20), minute: int(0, 59), second: int(0, 59) });
    const earlier = rand(); // always drawn, so the data mix does not depend on the time of day
    if (at <= now) return at.toJSDate();
    return day.plus({ minutes: Math.floor(earlier * Math.max(1, now.diff(day, "minutes").minutes)) }).toJSDate();
  };

  // ── Expenses grouped by (type, user, date) → one document each, like the app ──
  const groups = new Map<string, { source: Source; userId: mongoose.Types.ObjectId; date: string; at: Date; items: Record<string, unknown[]> }>();
  const debitsByUser = new Map<string, Record<string, unknown>[]>();
  const expenseTotalByUser = new Map<string, number>();
  const counts = { office: 0, travel: 0, toPay: 0 } as Record<Source, number>;

  for (let i = 0; i < EXPENSE_COUNT; i++) {
    const source: Source = weighted({ office: 46, travel: 34, toPay: 20 });
    const user = source === "toPay" ? pickUser(vendors) : pickUser(spenders);
    const day = randomDay();
    const at = randomTime(day);
    const category = weighted(CATEGORY_WEIGHTS[source]);
    const item = itemFor(category, source, day, today, at, i);
    const dateStr = day.toISODate()!;
    const key = `${source}|${user._id}|${dateStr}`;
    if (!groups.has(key)) groups.set(key, { source, userId: user._id as mongoose.Types.ObjectId, date: dateStr, at, items: {} });
    const g = groups.get(key)!;
    (g.items[category] ||= []).push(item);
    counts[source]++;

    // The app books every submitted claim as a debit on the claimant.
    const uid = String(user._id);
    if (!debitsByUser.has(uid)) debitsByUser.set(uid, []);
    debitsByUser.get(uid)!.push({
      _id: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId().toString(),
      tallyEntry: "",
      money: item.amount,
      reason: `${LABEL[category]} Expense`,
      remarks: item.description,
      imageUrl: [],
      createdAt: at,
      updatedAt: at,
    });
    expenseTotalByUser.set(uid, (expenseTotalByUser.get(uid) || 0) + item.amount);
  }

  const ops: Record<Source, mongoose.mongo.AnyBulkWriteOperation[]> = { office: [], travel: [], toPay: [] };
  const groupList = Array.from(groups.values());
  for (const g of groupList) {
    const push = Object.fromEntries(Object.entries(g.items).map(([c, items]) => [c, { $each: items }]));
    ops[g.source].push({
      updateOne: {
        filter: { createdBy: g.userId, date: g.date },
        update: { $push: push, $setOnInsert: { createdAt: g.at, updatedAt: g.at, seedTag: SEED_TAG, __v: 0 } } as never,
        upsert: true,
      },
    });
  }
  const newDocIds = new Map<string, mongoose.Types.ObjectId[]>();
  for (const source of Object.keys(ops) as Source[]) {
    if (!ops[source].length) continue;
    const res = await db.collection(COLLECTIONS[source]).bulkWrite(ops[source], { ordered: false });
    // Link newly created documents to their owner (users.expense), like the app does.
    const upserted = res.upsertedIds as Record<number, mongoose.Types.ObjectId>;
    const sourceGroups = groupList.filter((g) => g.source === source);
    for (const [idx, id] of Object.entries(upserted)) {
      const uid = String(sourceGroups[Number(idx)].userId);
      if (!newDocIds.has(uid)) newDocIds.set(uid, []);
      newDocIds.get(uid)!.push(id);
    }
  }

  // ── Credits: advances roughly covering each person's spend over the period ──
  const totalSpend = Array.from(expenseTotalByUser.values()).reduce((s, v) => s + v, 0);
  const creditsByUser = new Map<string, Record<string, unknown>[]>();
  // Split CREDIT_COUNT across people in proportion to their spend (largest remainder, exact total).
  const allocation = Array.from(expenseTotalByUser.entries()).map(([uid, spend]) => {
    const exact = (CREDIT_COUNT * spend) / totalSpend;
    return { uid, exact, n: Math.floor(exact) };
  });
  let remaining = CREDIT_COUNT - allocation.reduce((s, a) => s + a.n, 0);
  [...allocation].sort((a, b) => (b.exact - b.n) - (a.exact - a.n)).forEach((a) => {
    if (remaining > 0) { a.n++; remaining--; }
  });
  allocation.forEach(({ uid, n }) => {
    const target = expenseTotalByUser.get(uid)! * (1.02 + rand() * 0.15);
    const list: Record<string, unknown>[] = [];
    for (let k = 0; k < n; k++) {
      // Earlier advances are larger; spread across the whole period.
      const day = k === 0 ? firstDay.plus({ days: int(0, 3) }) : randomDay();
      const at = randomTime(day);
      const giver = pick(givers);
      const money = Math.max(500, Math.round(((target / n) * (0.5 + rand())) / 100) * 100);
      list.push({
        _id: new mongoose.Types.ObjectId(),
        transactionId: new mongoose.Types.ObjectId().toString(),
        tallyEntry: "",
        money,
        reason: pick(["Site advance", "Travel advance", "Petty cash top-up", "Imprest", "Vendor payment advance"]),
        remarks: `${pick(["UPI", "NEFT", "Cash"])} from ${giver.name}`,
        imageUrl: [],
        createdAt: at,
        updatedAt: at,
      });
    }
    creditsByUser.set(uid, list);
  });
  const creditsMade = Array.from(creditsByUser.values()).reduce((s, l) => s + l.length, 0);

  const userOps: mongoose.mongo.AnyBulkWriteOperation[] = [];
  const giver = givers.find((g) => g.role === "admin") || givers[0];
  for (const u of users) {
    const uid = String(u._id);
    const credits = creditsByUser.get(uid) || [];
    const debits = debitsByUser.get(uid) || [];
    const docs = newDocIds.get(uid) || [];
    if (!credits.length && !debits.length && !docs.length) continue;
    const at = new Date();
    const push: Record<string, unknown> = {};
    if (credits.length) push.credit = { _id: new mongoose.Types.ObjectId(), name: giver.name, email: giver.email || "", phone: String(giver.phone), transactionDetails: credits, seedTag: SEED_TAG, createdAt: at, updatedAt: at };
    if (debits.length) push.debit = { _id: new mongoose.Types.ObjectId(), name: u.name, email: u.email || "", phone: String(u.phone), transactionDetails: debits, seedTag: SEED_TAG, createdAt: at, updatedAt: at };
    const update: Record<string, unknown> = { $push: push };
    if (docs.length) update.$addToSet = { expense: { $each: docs } };
    userOps.push({ updateOne: { filter: { _id: u._id }, update: update as never } });
  }
  if (userOps.length) await db.collection("users").bulkWrite(userOps, { ordered: false });

  // ── Summary ──
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const totalCredits = Array.from(creditsByUser.values()).flat().reduce((s, c) => s + Number(c.money), 0);
  console.log("\nREPORT TEST DATA READY");
  console.log(`Date range: ${firstDay.toISODate()} → ${today.toISODate()} (${DAYS} days, ${ZONE})`);
  console.log(`Expense claims: ${EXPENSE_COUNT} (office ${counts.office}, travel ${counts.travel}, to-pay ${counts.toPay}) in ${groups.size} day-documents, total ${fmt(totalSpend)}`);
  console.log(`Credits (advances): ${creditsMade}, total ${fmt(totalCredits)}`);
  console.log(`Matching debits: ${EXPENSE_COUNT} (one per claim, as the app books them)`);
  console.log(`Generated records: ${EXPENSE_COUNT + creditsMade} expenses + credits across ${expenseTotalByUser.size} people`);
  console.log(`Remove with: npm run seed:reports -- --clean`);
}

main()
  .catch((err) => {
    console.error("Report seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
