// --- preload dotenv before anything else ---
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import * as handler from "./index.js"; // use * as for CommonJS exports

const app = express();

// Pass all requests to your existing addon router
app.use(handler.default || handler);

// Simple Render healthcheck endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "KJ-Torrentio-Scraper is live" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
