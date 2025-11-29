require("dotenv").config();
const express = require("express");
const app = express();
const connectDB = require("./database/db");
const productRoutes = require("./routes/productRoutes");
const bookRoutes = require("./routes/bookRoutes")
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Middlewares
app.use(express.json());

// Routes
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/books",bookRoutes );

// Connect to DB, then start server
connectDB(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on PORT ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect DB:", err.message);
  });
