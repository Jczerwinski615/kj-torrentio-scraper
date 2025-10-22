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
router.get(['/configure', '/:configuration/configure'], (req, res) => {
  const configuration = req.params.configuration || '';
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  const landingHTML = landingTemplate(manifest(configValues), configValues);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(landingHTML);
});

// --- Manifest routes ---
router.get(['/manifest.json', '/:configuration/manifest.json'], (req, res) => {
  const configuration = req.params.configuration || '';
  const host = `${req.protocol}://${req.headers.host}`;
  const configValues = { ...parseConfiguration(configuration), host };
  const manifestBuf = JSON.stringify(manifest(configValues));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(manifestBuf);
});

// --- Stream/meta resource routes ---
router.get(
  [
    '/:resource/:type/:id/:extra.json',
    '/:resource/:type/:id.json',
    '/:configuration/:resource/:type/:id/:extra.json',
    '/:configuration/:resource/:type/:id.json'
  ],
  limiter,
  (req, res, next) => {
    const { configuration, resource, type, id } = req.params;
    const extra = req.params.extra ? qs.parse(req.params.extra) : {};
    const ip = requestIp.getClientIp(req);
    const host = `${req.protocol}://${req.headers.host}`;
    const configValues = { ...extra, ...parseConfiguration(configuration || ''), id, type, ip, host };

    addonInterface
      .get(resource, type, id, configValues)
      .then((resp) => {
        const cacheHeaders = {
          cacheMaxAge: 'max-age',
          staleRevalidate: 'stale-while-revalidate',
          staleError: 'stale-if-error'
        };
        const cacheControl = Object.keys(cacheHeaders)
          .map((prop) => Number.isInteger(resp[prop]) && `${cacheHeaders[prop]}=${resp[prop]}`)
          .filter(Boolean)
          .join(', ');

        res.setHeader('Cache-Control', `${cacheControl}, public`);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(resp));
      })
      .catch((err) => {
        if (err.noHandler) {
          if (next) next();
          else {
            res.writeHead(404);
            res.end(JSON.stringify({ err: 'not found' }));
          }
        } else {
          console.error(err);
          res.writeHead(500);
          res.end(JSON.stringify({ err: 'handler error' }));
        }
      });
  }
);

// --- MOCH resolve routes ---
router.get('/resolve/:moch/:apiKey/:infoHash/:cachedEntryInfo/:fileIndex', handleMochResolve);
router.get('/resolve/:moch/:apiKey/:infoHash/:cachedEntryInfo/:fileIndex/:filename', handleMochResolve);

function handleMochResolve(req, res) {
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

  moch
    .resolve(parameters)
    .then((url) => {
      res.writeHead(302, { Location: url });
      res.end();
    })
    .catch((error) => {
      console.error(error);
      res.statusCode = 404;
      res.end();
    });
}

// --- Default 404 fallback ---
export default function (req, res) {
  router(req, res, function () {
    res.statusCode = 404;
    res.end();
  });
}
