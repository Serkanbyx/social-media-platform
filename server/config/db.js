import mongoose from "mongoose";
import env from "./env.js";

mongoose.set("strictQuery", true);

export const connectDB = async () => {
  if (!env.MONGO_URI) {
    console.error("[db] MONGO_URI is empty. Set it in server/.env before starting the API.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    if (!env.isProduction) {
      console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    }
    return conn;
  } catch (error) {
    console.error("[db] MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  if (!env.isProduction) console.warn("[db] MongoDB disconnected.");
});

mongoose.connection.on("reconnected", () => {
  if (!env.isProduction) console.log("[db] MongoDB reconnected.");
});

export default connectDB;
