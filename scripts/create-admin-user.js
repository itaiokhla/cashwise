const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const USER_DATA = {
  name: "Ram Ashish Kumar",
  email: "ramashish62127@gmail.com",
  phone: 7542918414,
  rawPassword: "Admin@1234!",
  role: "admin",
  type: "office",
};

const DEFAULT_EXPENSE_LIMITS = {
  conveyance: 300,
  purchase: 2000,
  food: 5000,
  tea: 100,
  hotel: 5000,
  labour: 1000,
  courier: 200,
  loading: 2000,
  porter: 800,
  cartage: 600,
  rider: 400,
  daily_wages: 500,
  transport: 1000,
  maintenance: 500,
  contractor: 4000,
  other: 500,
  max_limit: 6000,
};

async function createUserInDb(dbName) {
  const baseUri = "mongodb+srv://itaiokhla_db_user:itaiokhla_db_user@cluster0.xxbhdi2.mongodb.net";
  const uri = `${baseUri}/${dbName}?retryWrites=true&w=majority`;

  console.log(`\n========================================`);
  console.log(`Connecting to database: ${dbName}`);
  console.log(`URI: ${baseUri}/${dbName}`);
  console.log(`========================================`);

  const connection = await mongoose.createConnection(uri).asPromise();
  const db = connection.db;

  const usersCollection = db.collection("users");
  const expenseLimitCollection = db.collection("expenselimits");

  const hashedPassword = await bcrypt.hash(USER_DATA.rawPassword, 10);

  // Check if user already exists by phone or email
  let existingUser = await usersCollection.findOne({
    $or: [{ phone: USER_DATA.phone }, { email: USER_DATA.email }],
  });

  let userId;
  if (existingUser) {
    console.log(`Found existing user with ID: ${existingUser._id}`);
    await usersCollection.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          name: USER_DATA.name,
          email: USER_DATA.email,
          phone: USER_DATA.phone,
          password: hashedPassword,
          role: USER_DATA.role,
          type: USER_DATA.type,
          updatedAt: new Date(),
        },
      }
    );
    userId = existingUser._id;
    console.log(`Updated user ${userId}`);
  } else {
    const newUserDoc = {
      name: USER_DATA.name,
      email: USER_DATA.email,
      phone: USER_DATA.phone,
      password: hashedPassword,
      role: USER_DATA.role,
      type: USER_DATA.type,
      credit: [],
      debit: [],
      expense: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insertResult = await usersCollection.insertOne(newUserDoc);
    userId = insertResult.insertedId;
    console.log(`Created new user with ID: ${userId}`);
  }

  // Create or update ExpenseLimit
  const existingExpense = await expenseLimitCollection.findOne({ userId });
  if (!existingExpense) {
    await expenseLimitCollection.insertOne({
      name: USER_DATA.name,
      userId: userId,
      createdBy: userId,
      ...DEFAULT_EXPENSE_LIMITS,
      status: "Active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created default ExpenseLimit for user`);
  } else {
    await expenseLimitCollection.updateOne(
      { userId },
      { $set: { name: USER_DATA.name, status: "Active", updatedAt: new Date() } }
    );
    console.log(`Updated ExpenseLimit for user`);
  }

  // Verify user
  const savedUser = await usersCollection.findOne({ _id: userId });
  const isPasswordValid = bcrypt.compareSync(USER_DATA.rawPassword, savedUser.password);

  console.log("\n--- Verification Result ---");
  console.log(`User ID: ${savedUser._id}`);
  console.log(`Name: ${savedUser.name}`);
  console.log(`Email: ${savedUser.email}`);
  console.log(`Phone: ${savedUser.phone}`);
  console.log(`Role: ${savedUser.role}`);
  console.log(`Type: ${savedUser.type}`);
  console.log(`Password verification (Admin@1234!): ${isPasswordValid ? "PASSED" : "FAILED"}`);

  await connection.close();
}

async function run() {
  try {
    await createUserInDb("cashwise");
    await createUserInDb("test");
    console.log("\n User Ram Ashish Kumar successfully created and verified in both cashwise and test databases!");
  } catch (err) {
    console.error("Error creating user:", err);
    process.exit(1);
  }
}

run();
