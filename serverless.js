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
router.use(cors());

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  headers: false,
  keyGenerator: (req) => requestIp.getClientIp(req)
});

// --- Root redirect ---
router.get('/', (req, res) => {
  const host = `${req.protocol}://${req.headers.host}`;
  const html = landingTemplate(manifest({ host }), { host });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

// --- Preconfiguration redirect ---
router.get(/^\/(lite|brazuca)$/, (req, res) => {
  const preconfiguration = req.url.replace('/', '');
  const host = `${req.protocol}://${req.headers.host}`;
  res.writeHead(302, { Location: `${host}/${preconfiguration}/configure` });
  res.end();
});

// --- Configure route (handles root & preconfigs) ---
router.get(['/configure', '/:configuration/configure'], (req, res) => {
  const configuration = req.params.configuration || '';
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  const html = landingTemplate(manifest(configValues), configValues);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

// --- Manifest routes ---
router.get(['/manifest.json', '/:configuration/manifest.json'], (req, res) => {
  const configuration = req.params.configuration || '';
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  const manifestBuf = JSON.stringify(manifest(configValues));
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(manifestBuf);
});

// --- Stream/meta routes ---
router.get(['/:configuration/:resource/:type/:id/:extra.json', '/:resource/:type/:id/:extra.json'], limiter, (req, res, next) => {
  const { configuration, resource, type, id } = req.params;
  const extra = req.params.extra ? qs.parse(req.url.split('/').pop().slice(0, -5)) : {};
  const ip = requestIp.getClientIp(req);
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...extra, ...parseConfiguration(configuration || ''), id, type, ip, host };

  addonInterface.get(resource, type, id, configValues)
    .then(resp => {
      res.writeHead(200, {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600, stale-if-error=86400',
        'Content-Type': 'application/json; charset=utf-8'
      });
      res.end(JSON.stringify(resp));
    })
    .catch(err => {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ err: 'Internal server error' }));
    });
});

// --- MOCH resolve redirect ---
router.get(['/resolve/:moch/:apiKey/:infoHash/:cachedEntryInfo/:fileIndex', '/resolve/:moch/:apiKey/:infoHash/:cachedEntryInfo/:fileIndex/:filename'], (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const parameters = {
    mochKey: req.params.moch,
    apiKey: req.params.apiKey,
    infoHash: req.params.infoHash.toLowerCase(),
    fileIndex: isNaN(req.params.fileIndex) ? undefined : parseInt(req.params.fileIndex),
    cachedEntryInfo: req.params.cachedEntryInfo,
    ip: requestIp.getClientIp(req),
    host: `${req.protocol}://${req.headers.host}`,
    isBrowser: !userAgent.includes('Stremio') && !!userAgentParser(userAgent).browser.name
  };

  moch.resolve(parameters)
    .then(url => {
      res.writeHead(302, { Location: url });
      res.end();
    })
    .catch(error => {
      console.error(error);
      res.statusCode = 404;
      res.end();
    });
});

// --- Default 404 fallback ---
export default function (req, res) {
  router(req, res, function () {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
}
