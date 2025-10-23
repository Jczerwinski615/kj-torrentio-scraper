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
app.use(swStats.getMiddleware({
  name: manifest().name,
  version: manifest().version,
  timelineBucketDuration: 60 * 60 * 1000,
  apdexThreshold: 100,
  authentication: true,
  onAuthenticate: (req, username, password) => {
    return username === process.env.METRICS_USER
        && password === process.env.METRICS_PASSWORD
  },
}))
app.use(express.static('static', { maxAge: '1y' }));
app.use((req, res, next) => serverless(req, res, next));
// --- FIX START ---
const PORT = process.env.PORT || 11470;
let HOST = process.env.HOST || `http://localhost:${PORT}`;

// Normalize HOST if missing protocol
if (!HOST.startsWith('http')) {
  HOST = `http://${HOST}`;
}

app.listen(PORT, () => {
  initBestTrackers().then(() => {
    console.log(`Started addon at: ${HOST}`);
  });
});
// --- FIX END ---
