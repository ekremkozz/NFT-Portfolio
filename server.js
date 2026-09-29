#!/usr/bin/env node
/*
 * NFT Portfolio Lite -- a light, local view of an OpenSea portfolio.
 *
 * One small Node server with no dependencies. It reads what OpenSea's own
 * portfolio page reads, for the wallet addresses you give it, and serves one
 * page that draws it as two tables. It never asks for a private key or a seed
 * phrase and never signs anything: a wallet ADDRESS is all it needs.
 *
 * Everything it keeps -- your wallet list, NFTs added by hand, the last day of
 * price changes -- lives in ./data, on the machine it runs on.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 4180;
// Loopback only: the page is for whoever runs it. Codespaces forwards it
// privately to your own GitHub login.
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

/* Replaces a file in one step, so a crash never leaves half of it. */
function writeFileAtomic(target, body, mode = 0o600) {
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, body, { mode });
  fs.renameSync(temp, target);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim());
}

/*
 * Answers are gzipped when the browser accepts it. The portfolio answer for a
 * large wallet carries every piece held -- several megabytes of JSON that
 * compresses about tenfold.
 */
function send(res, status, body, headers = {}) {
  let payload = typeof body === 'string' ? body : JSON.stringify(body);
  const extra = {};
  const accepts = String(res.req?.headers['accept-encoding'] || '');
  if (payload.length > 2048 && /\bgzip\b/.test(accepts)) {
    payload = zlib.gzipSync(payload, { level: 6 });
    extra['content-encoding'] = 'gzip';
    extra.vary = 'Accept-Encoding';
  }
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------- settings
 *
 * The wallets to read, each with an optional short name, and optionally an
 * OpenSea API key. The key is only needed to add NFTs by hand; the portfolio
 * itself reads without one. An OPENSEA_API_KEY environment variable -- a
 * Codespaces secret, say -- wins over a key saved here, and the key is never
 * sent back to the page.
 */
function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const wallets = (Array.isArray(raw.wallets) ? raw.wallets : [])
      .filter((w) => w && isAddress(w.address))
      .map((w) => ({ address: w.address.toLowerCase(), label: String(w.label || '').slice(0, 24) }));
    return {
      wallets,
      apiKey: String(raw.apiKey || '').trim(),
      // The name shown on the profile card in place of OpenSea's, if one was set.
      profileName: String(raw.profileName || '').trim().slice(0, 40),
    };
  } catch {
    return { wallets: [], apiKey: '', profileName: '' };
  }
}

function writeConfig(config) {
  writeFileAtomic(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function readOpenSeaKey() {
  return String(process.env.OPENSEA_API_KEY || '').trim() || readConfig().apiKey;
}

/* OpenSea's REST API allows 120 reads a minute per account; stay well under. */
const API_MIN_GAP_MS = 700;
let apiNextSlot = 0;
async function apiPace() {
  const now = Date.now();
  const slot = Math.max(now, apiNextSlot);
  apiNextSlot = slot + API_MIN_GAP_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

async function openSeaApi(pathAndQuery, apiKey) {
  await apiPace();
  const response = await fetch('https://api.opensea.io/api/v2' + pathAndQuery, {
    headers: { accept: 'application/json', 'x-api-key': apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) throw new Error('The OpenSea API key is not valid');
  if (response.status === 429) throw new Error('OpenSea is rate-limiting us right now; try again shortly');
  if (!response.ok) throw new Error(`OpenSea API ${response.status}`);
  return response.json();
}

const NATIVE_TOKEN = {
  1: { id: 'ethereum', symbol: 'ETH' },
  10: { id: 'ethereum', symbol: 'ETH' },
  324: { id: 'ethereum', symbol: 'ETH' },
  4663: { id: 'ethereum', symbol: 'ETH' },   // Robinhood Chain
  8453: { id: 'ethereum', symbol: 'ETH' },   // Base
  57073: { id: 'ethereum', symbol: 'ETH' },  // Ink
  42161: { id: 'ethereum', symbol: 'ETH' },  // Arbitrum
  81457: { id: 'ethereum', symbol: 'ETH' },  // Blast
  7777777: { id: 'ethereum', symbol: 'ETH' }, // Zora
  56: { id: 'binancecoin', symbol: 'BNB' },
  137: { id: 'matic-network', symbol: 'POL' },
  43114: { id: 'avalanche-2', symbol: 'AVAX' },
  999: { id: 'hyperliquid', symbol: 'HYPE' },     // HyperEVM
};

const priceCache = new Map();

async function nativeTokenPrice(chainId) {
  const token = NATIVE_TOKEN[chainId];
  if (!token) return { available: false, reason: 'unmapped-chain' };

  const cached = priceCache.get(token.id);
  if (cached && Date.now() - cached.at < 300_000) {
    return { available: true, symbol: token.symbol, usd: cached.usd, cached: true };
  }
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${token.id}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const usd = body?.[token.id]?.usd;
    if (typeof usd !== 'number') throw new Error('no price field');
    priceCache.set(token.id, { usd, at: Date.now() });
    return { available: true, symbol: token.symbol, usd };
  } catch (error) {
    // Never fatal: the fee card just omits the dollar column.
    return { available: false, reason: error.message };
  }
}


/*
 * OpenSea's own portfolio page ships megabytes of app code to draw a grid the
 * browser then struggles with. The data behind it comes from plain GETs --
 * the site's own persisted queries, read-only and unauthenticated: no key, no
 * signature, nothing sent on anyone's behalf. This reads those and draws a
 * table. They are not a published API, so OpenSea can change them at any time.
 */
const OS_GQL = 'https://gql.opensea.io/graphql';
const OS_PROFILE_ITEMS_HASH =
  '5792fc7df6bcf14505656354ff35c68aa7612d23faacde65c0723fb453a6cad6';
const OS_TOKENS_HASH =
  '676ac9f1dc3d33b74f9a5c1b76e5ec05d3a5e7646fc4db2833d586b5e02ebdbe';
const OS_WEB_HEADERS = {
  accept: 'application/json',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

/*
 * One GET of a persisted OpenSea query. While OpenSea rolls out a release,
 * some of its servers do not know a query's hash yet and answer 400
 * PersistedQueryNotFound -- measured at one request in three, which emptied
 * the token table on every other refresh. The same request sent again lands
 * on another server, so that one answer is retried; anything else is final.
 */
async function openSeaGet(query, timeoutMs) {
  const url = `${OS_GQL}?${query}`;
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, {
      headers: OS_WEB_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 400 || attempt >= 4) return response;
    const text = await response.text();
    if (!text.includes('PERSISTED_QUERY_NOT_FOUND')) {
      return new Response(text, { status: response.status, headers: response.headers });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}


/*
 * Fungible balances across the same wallets. A portfolio that counts only the
 * NFTs is not the portfolio -- roughly a third of the value here sits in
 * tokens, and OpenSea's own headline figure includes them.
 */
async function openSeaTokensOnce(addresses) {
  const query = new URLSearchParams({
    app_id: 'os2-web',
    operationName: 'ProfileCurrencyStatsTableQuery',
    variables: JSON.stringify({
      addresses,
      filter: {},
      limit: 50,
      sort: { by: 'USD_VALUE', direction: 'DESC' },
      useTokenGrouping: true,
    }),
    extensions: JSON.stringify({
      persistedQuery: { sha256Hash: OS_TOKENS_HASH, version: 1 },
    }),
  });
  const response = await openSeaGet(query, 20000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  // An answer without the list is a failure, not an empty wallet.
  const list = body.data?.userCurrencyOwnershipsV2;
  if (!list) throw new Error(body.errors?.[0]?.message || 'no token list in the answer');
  {
    const rows = list.items || [];
    const balance = (row, group) => {
      const asset = row.asset || {};
      const head = group?.asset || {};
      return {
        id: row.id,
        name: head.name || asset.name || asset.symbol || '',
        symbol: head.symbol || asset.symbol || '',
        image: head.imageUrl || asset.imageUrl || '',
        chain: asset.chain?.identifier || '',
        contract: asset.contractAddress || '',
        quantity: Number(row.quantity) || 0,
        usd: Number(row.usdValue) || 0,
        priceUsd: Number(asset.usdPrice) || Number(head.primaryCurrency?.usdPrice) || 0,
        dayChange: Number(asset.stats?.oneDay?.priceChange)
          || Number(head.primaryCurrency?.stats?.oneDay?.priceChange) || 0,
        owner: (row.address || '').toLowerCase(),
      };
    };
    /*
     * A token held on several networks arrives as one group with no network
     * and no owner of its own; the parts are in underlyingBalances, one per
     * wallet and network. Those are what is returned, so each carries its
     * network and its wallet -- the table groups them back into one line and
     * the wallet filter can still tell whose each part is.
     */
    const tokens = rows.flatMap((row) => (Array.isArray(row.underlyingBalances) && row.underlyingBalances.length
      ? row.underlyingBalances.map((part) => balance(part, row))
      : [balance(row, null)]));
    return {
      tokens,
      tokenTotalUsd: tokens.reduce((sum, token) => sum + token.usd, 0),
    };
  }
}

/*
 * The token list, asked for up to three times. A failed read used to come
 * back as an empty list, which the page showed as "Token $0" -- a wrong
 * figure, not a missing one. Now a failure is retried, logged with its
 * reason, and reported as tokenError so the page can keep what it had.
 */
async function openSeaTokens(addresses) {
  let reason = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await openSeaTokensOnce(addresses);
    } catch (error) {
      reason = error.name === 'TimeoutError' ? 'timed out' : error.message;
      console.log(`  Tokens: attempt ${attempt} failed (${reason})`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return { tokens: [], tokenTotalUsd: 0, tokenError: reason || 'could not be read' };
}

/** One page of the profile grid. Cursor-paged, exactly as the site does it. */
async function openSeaPortfolioPage(addresses, cursor, sort = { by: 'RECEIVED_DATE', direction: 'DESC' }) {
  const variables = {
    address: addresses[0],
    addresses,
    limit: 50,
    sort,
  };
  /*
   * "after", not "cursor". A wrong name here is not an error: the server
   * ignores the unknown variable and cheerfully returns page one again, so
   * every extra page was the same fifty items and the portfolio total grew
   * in step with the page count. Verified by id overlap between pages.
   */
  if (cursor) variables.after = cursor;
  const query = new URLSearchParams({
    app_id: 'os2-web',
    operationName: 'ProfileItemsListQuery',
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { sha256Hash: OS_PROFILE_ITEMS_HASH, version: 1 },
    }),
  });
  const response = await openSeaGet(query, 20000);
  if (!response.ok) throw new Error(`OpenSea HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors[0].message || 'OpenSea error');
  return body.data?.profileItemsV2 || { items: [], nextPageCursor: null };
}

/*
 * Flattened to the handful of fields a table actually shows. The raw items
 * carry attributes, rarity, listings and more; keeping all of it would move
 * the weight problem from OpenSea's page into ours.
 */
/* One item from the profile list, cut down to what the tables show. */
function flattenItem(item) {
  const collection = item.collection || {};
  const floor = collection.floorPrice?.pricePerItem || {};
  const offer = collection.topOffer?.pricePerItem || {};
  return {
    id: item.id,
    name: item.name || `#${item.tokenId ?? ''}`,
    tokenId: item.tokenId ?? '',
    contract: item.contractAddress || '',
    image: item.imageUrl || '',
    collection: collection.name || collection.slug || '',
    slug: collection.slug || '',
    collectionImage: collection.imageUrl || '',
    verified: Boolean(collection.isVerified),
    chain: item.chain?.identifier || collection.chain?.identifier || '',
    owner: (item.owner?.address || '').toLowerCase(),
    floorUsd: Number(floor.usd) || 0,
    floorUnit: floor.token?.unit ?? null,
    floorSymbol: floor.token?.symbol || '',
    /*
     * Top offer, not floor, is what a holding is actually worth today:
     * the floor is what someone is ASKING, the top offer is what someone
     * is willing to PAY right now. Summing floors read about half as much
     * again as OpenSea's own valuation; summing top offers lands on it.
     */
    offerUsd: Number(offer.usd) || 0,
    offerUnit: offer.token?.unit ?? offer.native?.unit ?? null,
    offerSymbol: offer.token?.symbol || '',
    // OpenSea's rarity: its rank in the collection and the tier it falls in.
    rarityRank: Number(item.rarity?.rank) || 0,
    rarityTier: item.rarity?.category || '',
    // Its owner's own listing, if it is up for sale: the asking price.
    ...listingOf(item),
  };
}

function listingOf(item) {
  const order = item.lowestListingForOwner || item.bestListing;
  const price = order?.pricePerItem || {};
  return {
    listUsd: Number(price.usd) || 0,
    listUnit: price.token?.unit ?? null,
    listSymbol: price.token?.symbol || '',
  };
}

/*
 * The whole item list, read in the order the pieces arrived.
 *
 * OpenSea's list can be sorted by top offer, and was, so the value came in
 * first. But a collection held many times over has one top offer for all its
 * pieces, and among equal values OpenSea's pages are not stable: pieces came
 * twice and others never. Measured on a wallet holding 1,037 Meebits: sorted
 * by offer, a full read saw 483 of them and 195 pieces twice; sorted by the
 * date each piece arrived, it saw all 1,037 and nothing twice. So:
 *
 *   - the list is read by arrival date, whole, into a fresh copy that
 *     replaces the old only when complete; a piece missing from one read is
 *     kept, marked, and dropped only when missing from the next as well;
 *   - it is read again every half hour (every two hours for a list of more
 *     than 3,000 pieces);
 *   - between those, every few minutes: the first pages by arrival (a piece
 *     just bought comes first), and the first pages by top offer, whose
 *     prices are then set on every piece of those collections -- a price is
 *     the collection's, so the most valuable ones stay current.
 */
const QUICK_NEW_PAGES = 2;
const QUICK_PRICE_PAGES = 4;
const MAX_PAGES = 400;                 // 20,000 pieces
const LARGE_PAGES = 60;
const FULL_EVERY_MS = 30 * 60 * 1000;
const FULL_EVERY_LARGE_MS = 2 * 3600 * 1000;
const QUICK_EVERY_MS = 4 * 60 * 1000;
const BY_ARRIVAL = { by: 'RECEIVED_DATE', direction: 'DESC' };
const BY_OFFER = { by: 'TOP_OFFER', direction: 'DESC' };
let crawl = null;

/*
 * The list is kept on disk as well. An update restarts the app, and the
 * list only in memory was read again from nothing each time -- minutes, on
 * a large wallet, with the tables filling up from empty. Kept, it is back
 * the moment the app is, and read again in the background only when due.
 */
const ITEMS_CACHE_PATH = path.join(DATA_DIR, 'items-cache.json');

function saveCrawl(state) {
  try {
    writeFileAtomic(ITEMS_CACHE_PATH, JSON.stringify({
      key: state.key, fullAt: state.fullAt, quickAt: state.quickAt, pages: state.pages,
      items: [...state.items.values()],
    }));
  } catch (error) {
    console.log(`  Items: not kept on disk (${error.message})`);
  }
}

function loadCrawl(key) {
  try {
    const raw = JSON.parse(fs.readFileSync(ITEMS_CACHE_PATH, 'utf8'));
    if (raw.key !== key || !Array.isArray(raw.items)) return null;
    // Kept before rarity was read: shown, and read again in the background.
    const stale = raw.items.length && !raw.items.some((item) => 'rarityRank' in item && 'listUsd' in item);
    return {
      key, items: new Map(raw.items.map((item) => [item.id, item])), complete: true,
      progress: raw.items.length, running: null, fullAt: stale ? 0 : Number(raw.fullAt) || 0,
      quickAt: Number(raw.quickAt) || 0, pages: Number(raw.pages) || 0, error: '',
    };
  } catch {
    return null;
  }
}

/*
 * Pages in the given order until the list ends, `maxPages` are read, or
 * onPage says stop. Resolves to the pages read.
 */
async function readItemPages(addresses, { sort, maxPages, onPage }) {
  let cursor = null;
  let pages = 0;
  while (pages < maxPages) {
    const chunk = await openSeaPortfolioPage(addresses, cursor, sort);
    pages += 1;
    cursor = chunk.nextPageCursor || null;
    const stop = onPage((chunk.items || []).map(flattenItem));
    if (!cursor || stop) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { pages };
}

/*
 * A fresh read laid over the last: a piece missing from one read stays,
 * marked; only missing from two in a row is it dropped.
 */
function mergeRead(previous, fresh) {
  const merged = new Map();
  for (const [id, item] of fresh) merged.set(id, { ...item, missed: 0 });
  for (const [id, item] of previous) {
    if (!merged.has(id) && !(item.missed >= 1)) merged.set(id, { ...item, missed: 1 });
  }
  return merged;
}

const collectionKey = (item) => `${item.chain}|${item.slug || item.collection}`;

function fullReadEvery(state) {
  return state.pages > LARGE_PAGES ? FULL_EVERY_LARGE_MS : FULL_EVERY_MS;
}

function startFullRead(state, addresses) {
  if (state.running) return;
  const fresh = new Map();
  state.progress = 0;
  state.error = '';
  const run = readItemPages(addresses, {
    sort: BY_ARRIVAL,
    maxPages: MAX_PAGES,
    onPage: (items) => {
      for (const item of items) fresh.set(item.id, item);
      state.progress = fresh.size;
      // The first read shows as it goes; later ones swap in when done.
      if (!state.complete) state.items = fresh;
      return false;
    },
  })
    .then(({ pages }) => {
      state.items = state.complete ? mergeRead(state.items, fresh) : fresh;
      state.complete = true;
      state.pages = pages;
      state.fullAt = Date.now();
      state.quickAt = Date.now();
      saveCrawl(state);
    })
    .catch((error) => {
      state.error = error.message;
      console.log(`  Items: read stopped (${error.message})`);
    })
    .finally(() => { if (state.running === run) state.running = null; });
  state.running = run;
}

async function quickRead(state, addresses) {
  // A piece just bought comes first by arrival.
  const arrivals = [];
  await readItemPages(addresses, {
    sort: BY_ARRIVAL, maxPages: QUICK_NEW_PAGES, onPage: (items) => { arrivals.push(...items); return false; },
  });
  for (const item of arrivals) state.items.set(item.id, { ...item, missed: 0 });
  // The most valuable collections' prices, set on every piece of each.
  const priced = [];
  await readItemPages(addresses, {
    sort: BY_OFFER, maxPages: QUICK_PRICE_PAGES, onPage: (items) => { priced.push(...items); return false; },
  });
  const prices = new Map(priced.map((item) => [collectionKey(item), item]));
  for (const [id, item] of state.items) {
    const price = prices.get(collectionKey(item));
    if (!price) continue;
    state.items.set(id, {
      ...item,
      floorUsd: price.floorUsd, floorUnit: price.floorUnit, floorSymbol: price.floorSymbol,
      offerUsd: price.offerUsd, offerUnit: price.offerUnit, offerSymbol: price.offerSymbol,
    });
  }
  state.quickAt = Date.now();
  saveCrawl(state);
}

async function openSeaPortfolioItems(addresses, extraItems = []) {
  const key = addresses.join(',');
  const saved = (!crawl || crawl.key !== key) ? loadCrawl(key) : null;
  if (saved) {
    // Back from disk: shown at once, read again in the background if due.
    crawl = saved;
    if (Date.now() - crawl.fullAt > fullReadEvery(crawl)) startFullRead(crawl, addresses);
  } else if (!crawl || crawl.key !== key) {
    crawl = { key, items: new Map(), complete: false, progress: 0, running: null, fullAt: 0, quickAt: 0, pages: 0, error: '' };
    startFullRead(crawl, addresses);
    // The first answer waits for the first few pages, not for all of them.
    const started = Date.now();
    while (!crawl.complete && !crawl.error && crawl.progress < 200 && Date.now() - started < 15000) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } else if (crawl.complete && !crawl.running) {
    if (Date.now() - crawl.fullAt > fullReadEvery(crawl)) startFullRead(crawl, addresses);
    else if (Date.now() - crawl.quickAt > QUICK_EVERY_MS) await quickRead(crawl, addresses).catch(() => {});
  } else if (!crawl.complete && !crawl.running) {
    // A first read that failed part way is tried again.
    startFullRead(crawl, addresses);
  }

  const items = [...crawl.items.values()];
  // The hand-added pieces join here, so they group and total like the rest.
  items.push(...(await extraItems));

  return {
    collections: groupByCollection(items),
    itemCount: items.length,
    // Still reading the list: the page says how far, and the counts grow.
    loading: !crawl.complete,
    loaded: crawl.progress,
    complete: crawl.complete,
    // All of the list is one read now; nothing is read after.
    tailLoading: false,
    tailLoaded: 0,
    // When the whole list is next read again; shown on the no-offer heading.
    tailNextAt: crawl.fullAt ? crawl.fullAt + fullReadEvery(crawl) : 0,
    floorTotalUsd: items.reduce((sum, item) => sum + item.floorUsd, 0),
    offerTotalUsd: items.reduce((sum, item) => sum + item.offerUsd, 0),
  };
}

/* ---------------------------------------------------------------- profile
 *
 * The main wallet's OpenSea profile, for the card at the top of the page:
 * its name, picture, ENS name and bio. OpenSea serves no query for it; the
 * profile page carries it as JSON inside its HTML, which is read here and
 * cut down to those few fields. The page is over a megabyte, so the result
 * is kept for six hours (a failure for ten minutes). Anything missing just
 * leaves the card plainer: the address stands in for the name.
 */
const PROFILE_KEEP_MS = 6 * 3600 * 1000;
const PROFILE_RETRY_MS = 10 * 60 * 1000;
const profileCache = new Map();

function profileField(html, pattern) {
  const match = html.match(pattern);
  if (!match) return '';
  try { return JSON.parse(`"${match[1]}"`); } catch { return match[1]; }
}

async function openSeaProfile(address) {
  const key = address.toLowerCase();
  const cached = profileCache.get(key);
  if (cached && Date.now() < cached.until) return cached.profile;
  let profile = { address: key };
  try {
    const response = await fetch(`https://opensea.io/${key}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
        accept: 'text/html',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const str = '((?:[^"\\\\]|\\\\.)*)';
    // The account's own name and picture, when the wallet belongs to one.
    const account = html.match(new RegExp(`"profilesByAccount":\\{"account":\\{"address":"${key}","displayName":"${str}","imageUrl":"${str}"`, 'i'));
    const accountName = account ? profileField(account[0], new RegExp(`"displayName":"${str}"`)) : '';
    const accountImage = account ? profileField(account[0], new RegExp(`"imageUrl":"${str}"`)) : '';
    const walletImage = profileField(html, new RegExp(`"imageUrl":"(https://[^"]*/profiles/${key}/avatar/[^"]+)"`, 'i'));
    // OpenSea's blue tick: the flag that follows the account's own record
    // (or, without an account, the wallet's), never one elsewhere on the page.
    const tickAfter = (at) => at >= 0 && /"profileIsVerified":true/.test(html.slice(at, at + 400));
    const walletAt = html.search(new RegExp(`"imageUrl":"https://[^"]*/profiles/${key}/avatar/`, 'i'));
    const verified = account ? tickAfter(account.index) : tickAfter(walletAt);
    profile = {
      verified,
      address: key,
      name: accountName && !/^0x[0-9a-f]{40}$/i.test(accountName) ? accountName : '',
      ens: profileField(html, /"ensName":"([^"]+)"/),
      image: accountImage || walletImage,
      bio: profileField(html, new RegExp(`"bio":"${str}"`)),
      joined: profileField(html, /"dateJoined":"([^"]+)"/),
    };
    profileCache.set(key, { profile, until: Date.now() + PROFILE_KEEP_MS });
  } catch (error) {
    console.log(`  Profile not read (${error.message})`);
    profileCache.set(key, { profile, until: Date.now() + PROFILE_RETRY_MS });
  }
  return profile;
}

/*
 * One row per collection rather than per item. Holding twelve of something is
 * one position, and a table that lists it twelve times buries the eleven other
 * things you own. The individual pieces ride along so the row can show them
 * without a second request.
 */
function groupByCollection(items) {
  const groups = new Map();

  for (const item of items) {
    const key = item.slug || item.collection || item.id;
    let group = groups.get(key);
    if (!group) {
      group = {
        slug: item.slug,
        name: item.collection || item.slug,
        image: item.collectionImage,
        verified: item.verified,
        chain: item.chain,
        floorUsd: item.floorUsd,
        floorUnit: item.floorUnit,
        floorSymbol: item.floorSymbol,
        offerUsd: item.offerUsd,
        offerUnit: item.offerUnit,
        offerSymbol: item.offerSymbol,
        wallets: [],
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push({
      id: item.id,
      name: item.name,
      image: item.image,
      tokenId: item.tokenId,
      contract: item.contract,
      chain: item.chain,
      owner: item.owner,
      manual: item.manual || null,
      rarityRank: item.rarityRank || 0,
      rarityTier: item.rarityTier || '',
      listUsd: item.listUsd || 0,
    });
    if (item.owner && !group.wallets.includes(item.owner)) group.wallets.push(item.owner);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      held: group.items.length,
      valueUsd: group.items.length * group.offerUsd,
      floorValueUsd: group.items.length * group.floorUsd,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd || b.floorValueUsd - a.floorValueUsd);
}

/* ---------------------------------------------------------- manual NFTs
 *
 * Pieces OpenSea does not show under any of the wallets: staked, lent, or
 * parked in some other contract. They are still owned, so the portfolio
 * counts them -- added by hand from an OpenSea link, valued like the rest at
 * their collection's top offer.
 *
 * Kept in data/manual-nfts.json.
 */
const MANUAL_NFTS_PATH = path.join(DATA_DIR, 'manual-nfts.json');

function readManualNfts() {
  try {
    const raw = JSON.parse(fs.readFileSync(MANUAL_NFTS_PATH, 'utf8'));
    return Array.isArray(raw.entries) ? raw.entries : [];
  } catch {
    return [];
  }
}

function writeManualNfts(entries) {
  writeFileAtomic(MANUAL_NFTS_PATH, JSON.stringify({ entries }, null, 2));
}

/*
 * An OpenSea link, read for what it names: one piece
 * (/item/<chain>/<contract>/<id>, or the older /assets/...) or a whole
 * collection (/collection/<slug>).
 */
function parseOpenSeaLink(link) {
  let url;
  try {
    url = new URL(String(link || '').trim());
  } catch {
    return null;
  }
  if (!/(^|\.)opensea\.io$/i.test(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const at = parts.findIndex((part) => part === 'item' || part === 'assets');
  if (at >= 0 && parts.length >= at + 4) {
    const [chain, contract, tokenId] = parts.slice(at + 1, at + 4);
    if (isAddress(contract) && /^\d+$/.test(tokenId)) {
      return { kind: 'item', chain: chain.toLowerCase(), contract: contract.toLowerCase(), tokenId };
    }
  }
  const c = parts.indexOf('collection');
  if (c >= 0 && parts[c + 1]) return { kind: 'collection', slug: parts[c + 1] };
  return null;
}

/*
 * A dollar price for a native coin or its wrapped form, by symbol: ETH and
 * WETH read ether's, the rest the chain coin that carries that symbol.
 */
async function usdPerSymbol(symbol) {
  const plain = String(symbol || '').toUpperCase().replace(/^W(?=ETH$|BNB$|AVAX$|HYPE$|POL$)/, '');
  const chainId = Object.keys(NATIVE_TOKEN).find((id) => NATIVE_TOKEN[id].symbol === plain);
  if (chainId) {
    const price = await nativeTokenPrice(Number(chainId));
    if (price.available) return price.usd;
  }
  return usdPerSymbolFromItems(plain);
}

/*
 * The same rate from OpenSea's own figures, when CoinGecko will not answer:
 * it refuses cloud servers' addresses outright (403, then 429), and a zero
 * rate priced every hand-added piece at nothing. Each piece read carries its
 * floor both in the coin and in dollars; the middle of their ratios is the
 * coin's price as OpenSea reckons it.
 */
function usdPerSymbolFromItems(plain) {
  const ratios = [];
  for (const item of crawl ? crawl.items.values() : []) {
    const symbol = String(item.floorSymbol || '').toUpperCase().replace(/^W(?=ETH$|BNB$|AVAX$|HYPE$|POL$)/, '');
    if (symbol === plain && item.floorUnit > 0 && item.floorUsd > 0) ratios.push(item.floorUsd / item.floorUnit);
  }
  if (!ratios.length) return 0;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}

/*
 * A collection's name, picture and prices from OpenSea's keyed REST API.
 * Not the GraphQL endpoint the profile reads use: there, a query the site
 * does not itself send is throttled outright from this server. Three reads,
 * paced, kept five minutes -- the portfolio asks on every refresh, and a
 * few hand-added pieces should cost a few reads, not a burst. A failed read
 * keeps the last good one.
 */
const manualCollectionCache = new Map();

async function manualCollection(slug) {
  const cached = manualCollectionCache.get(slug);
  if (cached && Date.now() - cached.at < PORTFOLIO_MANUAL_TTL_MS) return cached.data;
  try {
    const apiKey = readOpenSeaKey();
    if (!apiKey) throw new Error('Pricing hand-added NFTs needs the OpenSea API key (Settings)');
    const safe = encodeURIComponent(slug);
    const c = await openSeaApi(`/collections/${safe}`, apiKey);
    if (!c || !c.collection) throw new Error(`OpenSea has no collection "${slug}"`);
    const stats = await openSeaApi(`/collections/${safe}/stats`, apiKey).catch(() => ({}));
    const offers = await openSeaApi(`/offers/collection/${safe}`, apiKey).catch(() => ({}));

    const floorUnit = Number(stats.total?.floor_price) || 0;
    const floorSymbol = stats.total?.floor_price_symbol || '';
    // The best collection offer, per piece: an offer for several pieces
    // carries their total, so it is divided by how many it asks for.
    let offerUnit = 0;
    let offerSymbol = '';
    for (const offer of offers.offers || []) {
      const params = offer.protocol_data?.parameters || {};
      // The offered amount itself when OpenSea leaves out its price summary.
      const price = offer.price || { value: params.offer?.[0]?.startAmount, decimals: 18, currency: 'WETH' };
      const count = Number(params.consideration?.[0]?.startAmount) || 1;
      const each = Number(price.value) / 10 ** (Number(price.decimals) || 18) / count;
      if (Number.isFinite(each) && each > offerUnit) {
        offerUnit = each;
        offerSymbol = price.currency || '';
      }
    }
    const [floorRate, offerRate] = await Promise.all([usdPerSymbol(floorSymbol), usdPerSymbol(offerSymbol)]);
    const info = {
      slug: c.collection,
      name: c.name || c.collection,
      image: c.image_url || '',
      verified: c.safelist_status === 'verified',
      chain: c.contracts?.[0]?.chain || '',
      floorUsd: floorUnit * floorRate,
      floorUnit: floorUnit || null,
      floorSymbol,
      offerUsd: offerUnit * offerRate,
      offerUnit: offerUnit || null,
      offerSymbol,
    };
    // A price that could not be turned into dollars is not kept as nothing.
    if ((floorUnit && !floorRate) || (offerUnit && !offerRate)) throw new Error('No dollar rate right now');
    manualCollectionCache.set(slug, { at: Date.now(), data: info });
    return info;
  } catch (error) {
    if (cached) return cached.data;
    throw error;
  }
}
const PORTFOLIO_MANUAL_TTL_MS = 5 * 60 * 1000;

/*
 * The hand-added pieces in the shape the profile's own items take, so they
 * group, sort and total with the rest. One that cannot be priced right now
 * still shows, at the prices it last had.
 */
async function manualPortfolioItems() {
  const entries = readManualNfts();
  const items = [];
  for (const entry of entries) {
    let info;
    try {
      info = await manualCollection(entry.slug);
    } catch {
      info = entry.collection || { slug: entry.slug, name: entry.slug, floorUsd: 0, offerUsd: 0 };
    }
    const count = Math.max(1, Math.min(Number(entry.quantity) || 1, 1000));
    for (let n = 0; n < count; n += 1) {
      items.push({
        id: `manual-${entry.id}-${n}`,
        name: entry.name || (entry.tokenId ? `#${entry.tokenId}` : info.name),
        tokenId: entry.tokenId || '',
        contract: entry.contract || '',
        image: entry.image || info.image || '',
        collection: info.name,
        slug: info.slug,
        collectionImage: info.image || '',
        verified: Boolean(info.verified),
        chain: entry.chain || info.chain || '',
        owner: String(entry.owner || '').toLowerCase(),
        floorUsd: info.floorUsd || 0,
        floorUnit: info.floorUnit ?? null,
        floorSymbol: info.floorSymbol || '',
        offerUsd: info.offerUsd || 0,
        offerUnit: info.offerUnit ?? null,
        offerSymbol: info.offerSymbol || '',
        manual: entry.id,
      });
    }
  }
  return items;
}

/* Turns a pasted link into an entry to keep: what it is, what it is called. */
async function resolveManualNft(link, quantity, owner) {
  const parsed = parseOpenSeaLink(link);
  if (!parsed) throw new Error('Paste an OpenSea item or collection link');
  const entry = {
    id: crypto.randomBytes(6).toString('hex'),
    owner: isAddress(owner) ? owner.toLowerCase() : '',
    addedAt: new Date().toISOString(),
  };
  if (parsed.kind === 'item') {
    const apiKey = readOpenSeaKey();
    if (!apiKey) throw new Error('Adding a single item needs the OpenSea API key (Settings)');
    const body = await openSeaApi(
      `/chain/${encodeURIComponent(parsed.chain)}/contract/${parsed.contract}/nfts/${parsed.tokenId}`, apiKey);
    const nft = body.nft || {};
    if (!nft.collection) throw new Error('OpenSea does not know this item');
    Object.assign(entry, {
      chain: parsed.chain,
      contract: parsed.contract,
      tokenId: parsed.tokenId,
      slug: nft.collection,
      name: nft.name || `#${parsed.tokenId}`,
      image: nft.display_image_url || nft.image_url || '',
      quantity: 1,
    });
  } else {
    Object.assign(entry, {
      slug: parsed.slug,
      quantity: Math.max(1, Math.min(Math.floor(Number(quantity) || 1), 1000)),
    });
  }
  // Priced once now, so a wrong slug fails here rather than on every refresh.
  const info = await manualCollection(entry.slug);
  entry.collection = info;
  if (!entry.chain) entry.chain = info.chain;
  return entry;
}

/* ------------------------------------------------------ price history
 *
 * Every portfolio read is set against the one before it, and a change is
 * written down: when, by how much in all, and which holdings moved it. Kept
 * on the server so every browser sees one history, and only for a day --
 * an event older than 24 hours is dropped the next time the file is written.
 *
 * Only holdings present in both reads are compared. A collection that just
 * came into (or fell out of) the pages read would otherwise count as a rise
 * (or fall) of its whole value, and a failed token read as tokens gone to 0.
 */
const PORTFOLIO_HISTORY_PATH = path.join(DATA_DIR, 'portfolio-history.json');
// A week: the page can group the changes by the hour, six, twelve or a day,
// and a day's steps want more than one day to compare.
const HISTORY_KEEP_MS = 7 * 24 * 3600 * 1000;

function readPortfolioHistory() {
  try {
    const raw = JSON.parse(fs.readFileSync(PORTFOLIO_HISTORY_PATH, 'utf8'));
    return {
      snapshot: raw.snapshot && raw.snapshot.values ? raw.snapshot : null,
      events: Array.isArray(raw.events) ? raw.events : [],
    };
  } catch {
    return { snapshot: null, events: [] };
  }
}

/* What each holding is worth in this read, keyed so the next read can find it. */
function portfolioValues(collections, tokens, tokensRead) {
  const values = {};
  for (const group of collections || []) {
    values[`c|${group.chain}|${group.slug || group.name}`] = { name: group.name, usd: group.valueUsd || 0 };
  }
  if (tokensRead) {
    for (const token of tokens || []) {
      const key = `t|${token.symbol}|${token.name}`;
      const entry = values[key] || (values[key] = { name: token.name || token.symbol, usd: 0 });
      entry.usd += token.usd || 0;
    }
  }
  return values;
}

/*
 * Compares this read with the last, records the change if there is one, and
 * returns it -- or null when nothing moved or there is nothing yet to compare.
 */
function recordPortfolioChange(values, total) {
  const now = Date.now();
  const history = readPortfolioHistory();
  let event = null;
  const before = history.snapshot;
  if (before) {
    let net = 0;
    const moves = [];
    for (const [key, entry] of Object.entries(values)) {
      const was = before.values[key];
      if (!was) continue;
      const change = entry.usd - was.usd;
      if (Math.abs(change) < 0.005) continue;
      net += change;
      moves.push({ name: entry.name, change: Math.round(change * 100) / 100 });
    }
    if (Math.abs(net) >= 0.01) {
      moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      event = {
        at: now,
        since: before.at,
        net: Math.round(net * 100) / 100,
        total: Math.round(total * 100) / 100,
        moves: moves.slice(0, 6),
      };
      history.events.push(event);
    }
  }
  // Holdings not in this read keep their last value for the next comparison.
  const snapshot = { at: now, values: { ...(before && before.values), ...values } };
  const events = history.events.filter((e) => now - e.at < HISTORY_KEEP_MS);
  try {
    writeFileAtomic(PORTFOLIO_HISTORY_PATH, JSON.stringify({ snapshot, events }));
  } catch (error) {
    console.log(`  Portfolio history not saved: ${error.message}`);
  }
  return event;
}


/* ---------------------------------------------------------------- routes */

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/* -------------------------------------------------------------- updates
 *
 * Once an hour, whether this repository has moved on: a `git fetch`, then
 * how many commits the checkout is behind. The page shows a note when it
 * is; restarting the app (which pulls first, see start.js) applies it.
 * Without git, or offline, nothing is shown.
 */
const UPDATE_CHECK_MS = 60 * 60 * 1000;
// Exit code that start.js takes as "pull the update and start me again".
const UPDATE_EXIT = 75;
const SUPERVISED = process.env.NFT_PORTFOLIO_SUPERVISED === '1';
const IDLE_BEFORE_UPDATE_MS = 10 * 60 * 1000;
// Any git checkout can update: under start.js by exiting, otherwise by
// handing over to start.js (see applyUpdateNow).
const CAN_SELF_UPDATE = SUPERVISED || fs.existsSync(path.join(__dirname, '.git'));

/*
 * Pulls the update and brings the app back on it. Under start.js: exit with
 * the code it reads as "pull and start me again". Started some other way --
 * `node server.js`, or a copy from before start.js existed -- nobody is there
 * to do that, so this process frees the port and starts start.js itself,
 * which pulls and runs the new version. This one stays only to keep the
 * terminal attached, and ends when the new app does.
 */
function applyUpdateNow() {
  if (SUPERVISED) {
    setTimeout(() => process.exit(UPDATE_EXIT), 300);
    return;
  }
  setTimeout(() => {
    server.close();
    if (server.closeAllConnections) server.closeAllConnections();
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [path.join(__dirname, 'start.js')], { cwd: __dirname, stdio: 'inherit' });
    // Ctrl+C reaches the new app directly; this one waits for it to close.
    process.on('SIGINT', () => {});
    child.on('exit', (code) => process.exit(code || 0));
  }, 300);
}
let lastActivity = Date.now();
let updateBehind = 0;
// The waiting commits' titles, newest first: what an update would bring.
let updateChanges = [];

/*
 * Each commit's title, and its Turkish one when the message carries a
 * "TR: ..." line: { en, tr }, or the title alone. The page shows the one
 * for its language. (start.js reads the same way.)
 */
const CHANGE_FORMAT = '--format=%s%x1f%(trailers:key=TR,valueonly,separator=%x20)%x1e';
function parseChanges(log) {
  return String(log).split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [title, tr = ''] = record.split('\x1f').map((part) => part.trim());
    return noteFor(title, tr);
  });
}

/*
 * A commit's note in both languages: its TR: line, or for commits made
 * before those existed, past-notes.json. The title alone when neither has it.
 */
function noteFor(title, tr = '') {
  if (tr) return { en: title, tr };
  let past = {};
  try { past = JSON.parse(fs.readFileSync(path.join(__dirname, 'past-notes.json'), 'utf8')); } catch { /* none */ }
  const entry = past[title];
  return entry && entry.tr ? { en: entry.en || title, tr: entry.tr } : title;
}

const LAST_UPDATE_PATH = path.join(DATA_DIR, 'last-update.json');

function readLastUpdate() {
  try {
    return JSON.parse(fs.readFileSync(LAST_UPDATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/* Resolves to the commits behind, or null when it could not tell. */
function checkForUpdate() {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.join(__dirname, '.git'))) { resolve(null); return; }
    const { execFile } = require('child_process');
    execFile('git', ['fetch', '--quiet'], { cwd: __dirname, timeout: 30_000 }, (fetchError) => {
      if (fetchError) { resolve(null); return; }
      execFile('git', ['rev-list', '--count', 'HEAD..@{upstream}'], { cwd: __dirname, timeout: 10_000 }, (error, out) => {
        if (error) { resolve(null); return; }
        updateBehind = Number(String(out).trim()) || 0;
        execFile('git', ['log', CHANGE_FORMAT, '-n', '15', 'HEAD..@{upstream}'], { cwd: __dirname, timeout: 10_000 }, (logError, log) => {
          updateChanges = logError ? [] : parseChanges(log);
          resolve(updateBehind);
        });
      });
    });
  });
}

function serveStatic(req, res, pathname) {
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, name));
  // Nothing outside public/: data/ holds the wallet list and the key.
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Not found');
  fs.readFile(file, (error, body) => {
    if (error) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'content-type': STATIC_TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname;
  lastActivity = Date.now();
  try {
    if (route === '/api/settings' && req.method === 'GET') {
      const config = readConfig();
      return send(res, 200, {
        wallets: config.wallets,
        profileName: config.profileName,
        apiKeySet: Boolean(readOpenSeaKey()),
        apiKeyFromEnv: Boolean(String(process.env.OPENSEA_API_KEY || '').trim()),
        updateBehind,
        updateChanges,
        // What the last start pulled in, once: start.js writes it, the page
        // shows it and clears it.
        lastUpdate: readLastUpdate(),
        // Any git checkout: see applyUpdateNow.
        canSelfUpdate: CAN_SELF_UPDATE,
      });
    }

    /*
     * "Update now": answer first, then exit with the code start.js reads as
     * "pull and start me again". The page waits for the app to come back and
     * reloads itself.
     */
    if (route === '/api/update/apply' && req.method === 'POST') {
      if (!CAN_SELF_UPDATE) return send(res, 409, { error: 'Restart the app with npm start to update it' });
      send(res, 200, { ok: true });
      console.log('\n  Updating: the app will be back in a moment.');
      applyUpdateNow();
      return undefined;
    }

    // The "what changed" note has been read: it does not come back.
    if (route === '/api/update/seen' && req.method === 'POST') {
      fs.rmSync(LAST_UPDATE_PATH, { force: true });
      return send(res, 200, { ok: true });
    }

    /*
     * The installed version's history: its latest commits, newest first,
     * each with its date and titles. Also how the page finds the Turkish
     * line for notes written as bare titles (by an older start.js).
     */
    if (route === '/api/update/history' && req.method === 'GET') {
      if (!fs.existsSync(path.join(__dirname, '.git'))) return send(res, 200, { history: [] });
      const { execFile } = require('child_process');
      const log = await new Promise((resolve) => {
        execFile('git', ['log', '-n', '40', '--format=%ct%x1f%s%x1f%(trailers:key=TR,valueonly,separator=%x20)%x1e'],
          { cwd: __dirname, timeout: 10_000 }, (error, out) => resolve(error ? '' : String(out)));
      });
      const history = log.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
        const [at, title, tr = ''] = record.split('\x1f').map((part) => part.trim());
        const note = noteFor(title, tr);
        return typeof note === 'string'
          ? { at: Number(at) * 1000, title, en: title, tr: '' }
          : { at: Number(at) * 1000, title, en: note.en, tr: note.tr };
      });
      return send(res, 200, { history });
    }

    // The header's "Check for updates": asked now rather than waiting the hour.
    if (route === '/api/update/check' && req.method === 'POST') {
      const behind = await checkForUpdate();
      return send(res, 200, { behind, known: behind !== null, changes: updateChanges });
    }

    if (route === '/api/settings' && req.method === 'POST') {
      const body = await readBody(req);
      const config = readConfig();
      if (Array.isArray(body.wallets)) {
        const seen = new Set();
        config.wallets = body.wallets
          .filter((w) => w && isAddress(w.address))
          .map((w) => ({ address: String(w.address).trim().toLowerCase(), label: String(w.label || '').trim().slice(0, 24) }))
          .filter((w) => !seen.has(w.address) && seen.add(w.address))
          .slice(0, 20);
      }
      if (typeof body.apiKey === 'string') config.apiKey = body.apiKey.trim();
      if (typeof body.profileName === 'string') config.profileName = body.profileName.trim().slice(0, 40);
      writeConfig(config);
      return send(res, 200, { ok: true, wallets: config.wallets, apiKeySet: Boolean(readOpenSeaKey()) });
    }

    if (route === '/api/portfolio' && req.method === 'GET') {
      const { wallets: configured } = readConfig();
      if (!configured.length) return send(res, 200, { available: false, reason: 'no-wallets' });
      const wallets = configured.map((w) => w.address);
      const manual = manualPortfolioItems().catch(() => []);
      const [items, tokens] = await Promise.all([
        openSeaPortfolioItems(wallets, manual),
        openSeaTokens(wallets),
      ]);
      // A list still being read would show its growth as price changes.
      const move = items.complete ? recordPortfolioChange(
        portfolioValues(items.collections, tokens.tokens, !tokens.tokenError),
        (items.collections || []).reduce((sum, g) => sum + (g.valueUsd || 0), 0) + (tokens.tokenTotalUsd || 0),
      ) : null;
      return send(res, 200, { available: true, wallets, move, ...tokens, ...items });
    }

    // The main wallet's profile, for the card at the top.
    if (route === '/api/profile' && req.method === 'GET') {
      const { wallets: configured } = readConfig();
      if (!configured.length) return send(res, 200, { profile: null });
      return send(res, 200, { profile: await openSeaProfile(configured[0].address) });
    }

    /*
     * How far the item read has got, and nothing else: while a long list is
     * read the page asks this every few seconds, and the whole portfolio --
     * megabytes for a large wallet -- only now and then.
     */
    if (route === '/api/portfolio/status' && req.method === 'GET') {
      return send(res, 200, {
        loading: Boolean(crawl && !crawl.complete),
        loaded: crawl ? crawl.progress : 0,
        tailLoading: false,
        tailLoaded: 0,
      });
    }

    if (route === '/api/portfolio/history' && req.method === 'GET') {
      const now = Date.now();
      const events = readPortfolioHistory().events
        .filter((e) => now - e.at < HISTORY_KEEP_MS)
        .sort((a, b) => b.at - a.at);
      return send(res, 200, { events });
    }

    if (route === '/api/portfolio/manual' && req.method === 'GET') {
      return send(res, 200, { entries: readManualNfts() });
    }

    if (route === '/api/portfolio/manual' && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const entry = await resolveManualNft(body.link, body.quantity, body.owner);
        const entries = readManualNfts();
        entries.push(entry);
        writeManualNfts(entries);
        return send(res, 200, { entry });
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    }

    if (route === '/api/portfolio/manual' && req.method === 'DELETE') {
      const id = String(url.searchParams.get('id') || '');
      const entries = readManualNfts();
      const kept = entries.filter((entry) => entry.id !== id);
      if (kept.length === entries.length) return send(res, 404, { error: 'No such entry' });
      writeManualNfts(kept);
      return send(res, 200, { ok: true });
    }

    if (route.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, route);
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
});

/*
 * In a codespace the app starts by itself when it opens, so a second
 * `npm start` finds the port taken. That is not an error worth a stack
 * trace: the app is already there.
 */
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log('');
    console.log(`  NFT Portfolio Lite is already running on port ${PORT}.`);
    console.log('  Open it from the Ports tab, or stop the other one first.');
    console.log('');
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  NFT Portfolio Lite is running.');
  /*
   * In a codespace, its own address, ready to click: the page the codespace
   * opens by itself is often stopped by the browser's pop-up blocker.
   */
  const codespace = process.env.CODESPACE_NAME;
  if (codespace) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    console.log(`  Open: https://${codespace}-${PORT}.${domain}`);
    console.log('  (Ctrl+click the link. Only you, signed in to GitHub, can open it.)');
  } else {
    console.log(`  Open: http://localhost:${PORT}`);
  }
  console.log('');
  checkForUpdate();
  /*
   * Hourly: look for an update, and if there is one and nobody has used the
   * app for ten minutes -- no page open, or one left in the background --
   * apply it straight away. start.js pulls it and brings the app back; a
   * page opened later is simply on the new version.
   */
  setInterval(async () => {
    const behind = await checkForUpdate();
    if (CAN_SELF_UPDATE && behind > 0 && Date.now() - lastActivity > IDLE_BEFORE_UPDATE_MS) {
      console.log('\n  Update found while idle: applying it.');
      applyUpdateNow();
    }
  }, UPDATE_CHECK_MS).unref();
});
