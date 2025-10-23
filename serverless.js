import Router from 'router';
import cors from 'cors';
import rateLimit from "express-rate-limit";
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
  res.writeHead(302, { Location: `${host}/configure` });
  res.end();
});

// --- Preconfiguration redirect ---
router.get('/:preconfiguration', (req, res, next) => {
  const { preconfiguration } = req.params;
  const validPreconfigs = Object.keys(PreConfigurations);
  if (!validPreconfigs.includes(preconfiguration)) return next();
  const host = `${req.protocol}://${req.headers.host}`;
  res.writeHead(302, { Location: `${host}/${preconfiguration}/configure` });
  res.end();
});

// --- Dedicated /configure page (Render-safe) ---
router.get('/configure', (req, res) => {
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { host };
  const landingHTML = landingTemplate(manifest(configValues), configValues);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(landingHTML);
});

// --- Configuration route (for specific configs) ---
router.get('/:configuration/configure', (req, res) => {
  const { configuration } = req.params;
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  const landingHTML = landingTemplate(manifest(configValues), configValues);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(landingHTML);
});

// --- Manifest routes ---
router.get('/manifest.json', (req, res) => {
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { host };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(manifest(configValues)));
});

router.get('/:configuration/manifest.json', (req, res) => {
  const { configuration } = req.params;
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(manifest(configValues)));
});

// --- Stream/meta resource route ---
router.get(['/:configuration/:resource/:type/:id/:extra.json', '/:resource/:type/:id/:extra.json'], limiter, (req, res, next) => {
  const { configuration, resource, type, id } = req.params;
  const extra = req.params.extra ? qs.parse(req.url.split('/').pop().replace('.json', '')) : {};
  const ip = requestIp.getClientIp(req);
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...extra, ...parseConfiguration(configuration || '')
