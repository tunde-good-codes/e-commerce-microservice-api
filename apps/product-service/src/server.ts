import dotenv from "dotenv";
dotenv.config();

import express from "express";
import "./jobs/productCronJobs"
//import * as path from "path";

import cookieParser from "cookie-parser";

//import swaggerUi from "swagger-ui-express";
import router from "./routes/product.route.js";
//const swaggerDocument = require("./swagger-output.json");
import cors from "cors";
import { errorMiddleware } from "@shared/error-handler/error-middleware";
const app = express();

app.use(express.json());
//app.use("/assets", express.static(path.join(__dirname, "assets")));

app.use(express.json());

app.use(cookieParser());
// Your routes here
app.use(
  cors({
    origin: ["https://localhost:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.use("/api/product", router);
//app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// app.get("/docs-json", (req, res) => {
//   res.json({
//     swaggerDocument,
//   });
// });

app.get("/api/product", (req, res) => {
  res.send({ message: "Welcome to product-service!" });
});
app.get("/", (req, res) => {
  res.send({ message: "Welcome  a to product-service!" });
});

// Add this endpoint
app.get("/product", (req, res) => {
  res.json({
    message: "product service is working via gateway!",
    success: true,
    timestamp: new Date().toISOString(),
  });
});

// Keep your existing root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "product-service is here",
    success: true,
  });
});
// Error middleware MUST be last
app.use(errorMiddleware);

const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Product Service listening at http://localhost:${PORT}/api/product`);
  console.log(`Swagger Service listening at http://localhost:${PORT}/docs`);
});
// server()
// server.on("error", console.error);
