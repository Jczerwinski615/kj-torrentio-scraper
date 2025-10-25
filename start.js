// --- preload dotenv before anything else ---
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import * as addon from "./index.js";

const app = express();

// Try to detect what index.js exported and mount correctly
const handler =
  typeof addon === "function"
    ? addon
    : addon.default && typeof addon.default === "function"
    ? addon.default
    : addon.router || addon.default || addon;

if (typeof handler === "function") {
  app.use(handler);
} else {
  console.warn("⚠️ No valid middleware exported from index.js");
}

// Simple Render health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "KJ-Torrentio-Scraper is live" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
