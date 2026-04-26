import mongoose from "mongoose";

export async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.log("MongoDB not configured. Running in in-memory mode.");
    return { connected: false };
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGO_DB_NAME || "fraud_detection_dashboard",
    });
    console.log("MongoDB connected.");
    return { connected: true };
  } catch (error) {
    console.error("MongoDB connection failed. Falling back to in-memory mode.", error.message);
    return { connected: false, error: error.message };
  }
}
