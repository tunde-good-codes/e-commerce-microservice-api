import mongoose from "mongoose";

const connectDb = async () => {
  try {
    mongoose.connect(process.env.MONGO_URI as string, {
      dbName: "ADMIN-DASHBOARD",
    });

    console.log("Connected to mongodb");
  } catch (error) {
    console.log(error, "error connecting to db");
  }
};

export default connectDb;
