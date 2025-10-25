import dotenv from "dotenv";
dotenv.config();

import './lib/repository.js';

import express from 'express';
import swStats from 'swagger-stats';
import serverless from './serverless.js';
import { manifest } from './lib/manifest.js';
import { initBestTrackers } from './lib/magnetHelper.js';

const app = express();
app.enable('trust proxy');

// Swagger stats middleware
app.use(swStats.getMiddleware({
  name: manifest().name,
  version: manifest().version,
  timelineBucketDuration: 60 * 60 * 1000,
  apdexThreshold: 100,
  authentication: true,
  onAuthenticate: (req, username, password) =>
    username === process.env.METRICS_USER &&
    password === process.env.METRICS_PASSWORD,
}));

// Serve static files
app.use(express.static('static', { maxAge: '1y' }));

// Use the router (middleware) exported by serverless.js
app.use(serverless);

// --- FIX START ---
const PORT = process.env.PORT || 11470;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  await initBestTrackers();
  console.log(`✅ KJ-Torrentio-Scraper is live on port ${PORT}`);
});
// --- FIX END ---

// ✅ Export Express app (middleware) for start.js and Render
export default app;
