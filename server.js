"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
loadDotEnv(path.join(root, ".env"));

const port = clamp(Number(process.env.PORT || 5173), 1, 65535);
const maxRequestsPerMinute = clamp(Number(process.env.RATE_LIMIT_PER_MINUTE || 30), 1, 1000);
const requestTimeoutMs = clamp(Number(process.env.SERPER_TIMEOUT_MS || 15000), 3000, 60000);
const serperConcurrency = clamp(Number(process.env.SERPER_CONCURRENCY || 3), 1, 10);
const rateBuckets = new Map();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);

  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: "advanced-serp-checker",
        version: require("./package.json").version,
        hasServerKey: Boolean(process.env.SERPER_API_KEY),
        maxResults: 100
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search") {
      enforceRateLimit(req);
      await handleSearch(req, res, requestId);
      return;
    }

    if (req.method === "GET") {
      serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed", requestId });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.status ? error.message : "Server error",
      detail: error.detail || error.message,
      requestId
    });
  }
});

if (require.main === module) {
  server.listen(port, () => {
    console.log("Advanced SERP Checker running at http://127.0.0.1:" + port);
  });
}

async function handleSearch(req, res, requestId) {
  const payload = await readJson(req);
  const apiKey = process.env.SERPER_API_KEY || req.headers["x-serper-key"] || cleanString(payload.apiKey);

  if (!apiKey || apiKey === "your_serper_api_key_here") {
    throw httpError(400, "Missing Serper API key", "Set SERPER_API_KEY in .env or paste a key in the app.");
  }

  const query = cleanString(payload.q || payload.query);
  if (!query) {
    throw httpError(400, "Search keyword is required");
  }
  if (query.length > 300) {
    throw httpError(400, "Search keyword must be 300 characters or fewer");
  }

  const requestedNum = clamp(Number(payload.num || 20), 1, 100);
  const startPage = clamp(Number(payload.page || 1), 1, 10);
  const perPage = 10;
  const basePayload = {
    q: query,
    gl: normalizedCode(payload.gl, "us"),
    hl: normalizedCode(payload.hl, "en"),
    num: perPage,
    autocorrect: payload.autocorrect !== false
  };

  const device = cleanString(payload.device).toLowerCase();
  if (["desktop", "mobile", "tablet"].includes(device)) {
    basePayload.device = device;
  }

  const location = cleanString(payload.location);
  if (location && location.toLowerCase() !== "anywhere") {
    basePayload.location = location.slice(0, 150);
  }

  const tbs = cleanString(payload.tbs);
  if (tbs) {
    basePayload.tbs = tbs.slice(0, 80);
  }

  const availablePages = 10 - startPage + 1;
  const pageCount = Math.min(Math.ceil(requestedNum / perPage), availablePages);
  const pages = Array.from({ length: pageCount }, (_, offset) => startPage + offset);
  const pageResponses = await mapWithConcurrency(pages, serperConcurrency, async page => {
    const pagePayload = { ...basePayload, page };
    return { page, data: await fetchSerper(apiKey, pagePayload) };
  });
  pageResponses.sort((a, b) => a.page - b.page);

  const mergedData = mergeSerperResponses(pageResponses, requestedNum, perPage);
  const fetchedPages = pageResponses.map(item => item.page);

  sendJson(res, 200, {
    provider: "serper.dev",
    requestId,
    request: {
      ...basePayload,
      num: requestedNum,
      page: startPage,
      location: location || "Anywhere",
      device: basePayload.device || "desktop",
      fetchedPages,
      creditsUsed: fetchedPages.length
    },
    coverage: {
      requested: requestedNum,
      returned: mergedData.organic.length,
      complete: mergedData.organic.length >= requestedNum
    },
    fetchedAt: new Date().toISOString(),
    data: mergedData
  });
}

async function fetchSerper(apiKey, payload, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    const data = parseJson(text);

    if (response.ok) {
      return data;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await wait(350 * (attempt + 1));
      return fetchSerper(apiKey, payload, attempt + 1);
    }

    throw httpError(response.status, data.message || data.error || "Serper request failed", data);
  } catch (error) {
    if (error.name === "AbortError") {
      throw httpError(504, "Serper request timed out", "No response within " + requestTimeoutMs + "ms.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeSerperResponses(pageResponses, requestedNum, perPage = 10) {
  const first = pageResponses[0]?.data || {};
  return {
    ...first,
    ads: Array.isArray(first.ads) ? first.ads : [],
    organic: mergeOrganic(pageResponses, requestedNum, perPage)
  };
}

function mergeOrganic(pageResponses, requestedNum, perPage = 10) {
  const seen = new Set();
  const organic = [];

  for (const { page, data } of pageResponses) {
    const pageItems = Array.isArray(data.organic) ? data.organic : [];
    for (const [index, item] of pageItems.entries()) {
      const canonical = canonicalUrl(item.link || item.url) || (item.title || "result") + "-" + page + "-" + index;
      if (seen.has(canonical)) {
        continue;
      }

      seen.add(canonical);
      organic.push({
        ...item,
        sourcePosition: item.position ?? null,
        page,
        position: resolvePosition(item.position, page, index, perPage)
      });

      if (organic.length >= requestedNum) {
        return organic;
      }
    }
  }

  return organic;
}

function resolvePosition(rawPosition, page, index, perPage = 10) {
  const fallback = (page - 1) * perPage + index + 1;
  const raw = Number(rawPosition);
  if (!Number.isInteger(raw) || raw < 1) {
    return fallback;
  }

  const pageStart = (page - 1) * perPage + 1;
  const pageEnd = pageStart + perPage - 1;
  if (raw >= pageStart && raw <= pageEnd) {
    return raw;
  }
  if (raw <= perPage) {
    return pageStart + raw - 1;
  }
  return fallback;
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return cleanString(value).toLowerCase();
  }
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const requested = path.resolve(publicDir, "." + safePath);
  if (!requested.startsWith(publicDir + path.sep)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(requested, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }
    const ext = path.extname(requested).toLowerCase();
    writeHeaders(res, 200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
}

function enforceRateLimit(req) {
  const forwarded = cleanString(req.headers["x-forwarded-for"]).split(",")[0];
  const key = forwarded || req.socket.remoteAddress || "local";
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > maxRequestsPerMinute) {
    throw httpError(429, "Too many searches", "Wait a minute before trying again.");
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > 64 * 1024) {
        reject(httpError(413, "Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(httpError(400, "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  writeHeaders(res, status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  writeHeaders(res, status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function writeHeaders(res, status, headers) {
  res.writeHead(status, { ...securityHeaders, ...headers });
}

function normalizedCode(value, fallback) {
  const code = cleanString(value).toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : fallback;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function httpError(status, message, detail) {
  const error = new Error(message);
  error.status = status;
  error.detail = detail;
  return error;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equals = trimmed.indexOf("=");
    if (equals === -1) {
      continue;
    }
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  canonicalUrl,
  mergeOrganic,
  mergeSerperResponses,
  resolvePosition,
  server
};

