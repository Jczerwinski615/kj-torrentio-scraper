import Router from 'router';
import cors from 'cors';
import rateLimit from "express-rate-limit";
import requestIp from 'request-ip';
import userAgentParser from 'ua-parser-js';
import addonInterface from './addon.js';
import qs from 'querystring';
import { manifest } from './lib/manifest.js';
import { parseConfiguration } from './lib/configuration.js';
import landingTemplate from './lib/landingTemplate.js';
import * as moch from './moch/moch.js';

const router = new Router();

// --- Rate limiter ---
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
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

// --- /configure route ---
router.get(['/configure', '/:configuration/configure'], (req, res) => {
  const configuration = req.params.configuration || '';
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  const landingHTML = landingTemplate(manifest(configValues), configValues);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(landingHTML);
});

// --- Manifest route ---
router.get(['/manifest.json', '/:configuration/manifest.json'], (req, res) => {
  const configuration = req.params.configuration || '';
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(manifest(configValues)));
});

// --- Stream/meta route ---
router.get(['/:configuration/:resource/:type/:id/:extra.json', '/:resource/:type/:id/:extra.json'], limiter, (req, res, next) => {
  const { configuration, resource, type, id } = req.params;
  const extra = req.params.extra ? qs.parse(req.url.split('/').pop().slice(0, -5)) : {};
  const ip = requestIp.getClientIp(req);
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...extra, ...parseConfiguration(configuration || ''), id, type, ip, host };

  addonInterface.get(resource, type, id, configValues)
    .then(resp => {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(resp));
    })
    .catch(err => {
      console.error(err);
      res.writeHead(err.noHandler ? 404 : 500);
      res.end(JSON.stringify({ err: err.noHandler ? 'not found' : 'handler error' }));
    });
});

// --- MOCH resolve redirect ---
router.get('/resolve/:moch/:apiKey/:infoHash/:cachedEntryInfo/:fileIndex/:filename', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const parameters = {
    mochKey: req.params.moch,
    apiKey: req.params.apiKey,
    infoHash: req.params.infoHash.toLowerCase(),
    fileIndex: parseInt(req.params.fileIndex) || 0,
    cachedEntryInfo: req.params.cachedEntryInfo,
    ip: requestIp.getClientIp(req),
    host: `${req.protocol}://${req.headers.host}`,
    isBrowser: !userAgent.includes('Stremio') && !!userAgentParser(userAgent).browser.name
  };

  moch.resolve(parameters)
    .then(url => res.redirect(url))
    .catch(err => {
      console.error(err);
      res.statusCode = 404;
      res.end();
    });
});

// --- Fully Stremio-compatible ping and server info ---
router.get([
  '/stremio',
  '/stremio/v1',
  '/stremio/v1/server.json',
  '/stremio/v1/ping',
  '/stremio/ping'
], (req, res) => {
  const base = `${req.protocol}://${req.headers.host}`;
  const serverInfo = {
    id: "org.stremio.kj-torrentio",
    version: "1.0.0",
    name: "KJ Torrentio Scraper",
    description: "Streaming server for Stremio",
    behaviorHints: {
      configurable: false,
      configurationRequired: false
    },
    resources: ["stream", "meta"],
    types: ["movie", "series"],
    catalogs: [],
    logo: `${base}/logo.png`
  };

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(JSON.stringify(serverInfo));
});
// --- Debug logger for Fire TV requests ---
router.get('/debug/firetv', (req, res) => {
  console.log('🔥 FireTV Check:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    ip: req.socket.remoteAddress
  });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, headers: req.headers, url: req.url }));
});

// Catch all Stremio debug (to see what Fire TV actually requests)
router.get('/debug/*', (req, res) => {
  console.log('🔥 DEBUG incoming:', req.url);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ path: req.url, headers: req.headers }));
});

// --- Default 404 fallback ---
export default function (req, res) {
  router(req, res, () => {
    res.statusCode = 404;
    res.end('Not Found');
  });
}
