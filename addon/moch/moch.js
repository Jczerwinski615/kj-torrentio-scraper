import * as options from './options.js';
import StaticResponse, { isStaticUrl } from './static.js';
import { cacheWrapResolvedUrl } from '../lib/cache.js';
import { timeout } from '../lib/promises.js';
import { BadTokenError, streamFilename } from './mochHelper.js';
import { createNamedQueue } from "../lib/namedQueue.js";

const RESOLVE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const MIN_API_KEY_SYMBOLS = 15;
const TOKEN_BLACKLIST = [];

// ✅ No external MOCH providers needed
export const MochOptions = {};

const unrestrictQueues = {};

export function hasMochConfigured(config) {
  return Object.keys(MochOptions).find(moch => config?.[moch]);
}

export async function applyMochs(streams, config) {
  if (!streams?.length || !hasMochConfigured(config)) {
    return streams;
  }
  return streams;
}

export async function resolve(parameters) {
  return Promise.reject(new Error("No MOCH providers available in this build"));
}

export async function getMochCatalog() {
  return Promise.reject(new Error("No MOCH catalogs available"));
}

export async function getMochItemMeta() {
  return Promise.reject(new Error("No MOCH metadata available"));
}

function isInvalidToken(token, mochKey) {
  return token.length < MIN_API_KEY_SYMBOLS || TOKEN_BLACKLIST.includes(`${mochKey}|${token}`);
}

function blackListToken(token, mochKey) {
  const tokenKey = `${mochKey}|${token}`;
  console.log(`Blacklisting invalid token: ${tokenKey}`);
  TOKEN_BLACKLIST.push(tokenKey);
}
