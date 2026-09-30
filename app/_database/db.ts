import mongoose from "mongoose";

let connected = false;

async function dbConnect() {
  mongoose.set("strictQuery", true);

  if (connected) {
    console.log("MongoDB is already connected");
    return;
  }

  const mongoUri = process.env.MONGODB_URI;

  // Check if the URI is undefined and log an error if it is
  if (!mongoUri) {
    console.error("MongoDB URI is not defined in the environment variables.");
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    connected = true;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

export default dbConnect;
