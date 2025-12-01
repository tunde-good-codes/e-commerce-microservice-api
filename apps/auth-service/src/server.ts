import dotenv from "dotenv";
dotenv.config();

import express from "express";

//import * as path from "path";

import cookieParser from "cookie-parser";

import swaggerUi from "swagger-ui-express";
//import { errorMiddleware } from "@packages/error-handler/error-middleware";
import router from "./routes/auth.router";
import { errorMiddleware } from "@shared/error-handler/error-middleware";
const swaggerDocument = require("./swagger-output.json");
import cors from "cors"
import { corsOptions } from "@shared/middleware";
const app = express();

app.use(express.json());
//app.use("/assets", express.static(path.join(__dirname, "assets")));

app.use(express.json());

app.use(cookieParser());
// Your routes here
app.use(cors(corsOptions()));

app.use("/api/auth", router);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs-json", (req, res) => {
  res.json({
    swaggerDocument,
  });
});

app.get("/api", (req, res) => {
  res.send({ message: "Welcome to auth-service!" });
});
app.get("/", (req, res) => {
  res.send({ message: "Welcome  a to auth-service!" });
});

// Add this endpoint
app.get("/auth", (req, res) => {
  res.json({
    message: "Auth service is working via gateway!",
    success: true,
    timestamp: new Date().toISOString(),
  });
});

// Keep your existing root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "auth-service is here",
    success: true,
  });
});
// Error middleware MUST be last
app.use(errorMiddleware);

const PORT = process.env.AUTH_SERVICE_PORT || 8081;
app.listen(PORT, () => {
  console.log(`Auth Service listening at http://localhost:${PORT}/api/auth`);
  console.log(`Swagger Service listening at http://localhost:${PORT}/docs`);
});
// server()
// server.on("error", console.error);
