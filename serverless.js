import Router from 'router';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';
import userAgentParser from 'ua-parser-js';
import addonInterface from './addon.js';
import qs from 'querystring';
import { manifest } from './lib/manifest.js';
import { parseConfiguration, PreConfigurations } from './lib/configuration.js';
import landingTemplate from './lib/landingTemplate.js';
import * as moch from './moch/moch.js';

const router = new Router();

// --- Rate limiter ---
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 300,
  headers: false,
  keyGenerator: (req) => requestIp.getClientIp(req)
});

router.use(cors());

// --- Root redirect ---
router.get('/', (req, res) => {
  const host = `${req.protocol}://${req.headers.host}`;
  res.redirect(`${host}/configure`);
  res.end();
});

// --- Preconfiguration redirect ---
router.get('/:preconfiguration', (req, res) => {
  const { preconfiguration } = req.params;
  const validPreconfigs = Object.keys(PreConfigurations);

  if (!validPreconfigs.includes(preconfiguration)) {
    res.statusCode = 404;
    res.end('Invalid preconfiguration');
    return;
  }

  const host = `${req.protocol}://${req.headers.host}`;
  res.redirect(`${host}/${preconfiguration}/configure`);
  res.end();
});

// --- /configure routes ---
router.get(['/configure', '/:configuration/configure'],
