import dotenv from "dotenv";
dotenv.config();

import "./lib/repository.js";
import express from "express";
import swStats from "swagger-stats";
import serverless from "./serverless.js";
import { manifest } from "./lib/manifest.js";
import { initBestTrackers } from "./lib/magnetHelper.js";

const app = express();
app.enable("trust proxy");

// Swagger stats middleware
app.use(
  swStats.getMiddleware({
    name: manifest().name,
    version: manifest().version,
    timelineBucketDuration: 60 * 60 * 1000,
    apdexThreshold: 100,
    authentication: true,
    onAuthenticate: (req, username, password) =>
      username === process.env.METRICS_USER &&
      password === process.env.METRICS_PASSWORD,
  })
);

// Serve static files
app.use(express.static("static", { maxAge: "1y" }));

// Use the router (middleware) exported by serverless.js
app.use(serverless);

// Initialize trackers (no listening here)
initBestTrackers().then(() =>
  console.log("✅ Best trackers initialized successfully")
);

// --- Health check route for Render & external verification ---
app.get(['/health', '/stremio/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'KJ-Torrentio-Scraper backend is healthy and online'
  });
});


// ✅ Export app only — no app.listen() here
export default app;
