import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import noteRoutes from "./routes"
import {
  corsOptions,
  errorHandler,
  healthCheck,
} from "../../../shared/middleware";
import connectDb from "./database";

//load environment variables
dotenv.config();

const app = express();
connectDb();
const PORT = process.env.PORT || 8083;

// setup middlewares
app.use(cors(corsOptions()));
app.use(helmet());

// parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/notes", noteRoutes);
app.get("/health", healthCheck);

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Note service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
