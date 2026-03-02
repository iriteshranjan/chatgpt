const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8000);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const STOCK_CACHE_FILE = path.join(__dirname, 'data', 'stocks-by-letter.json');

const memoryCache = {
  stocksByLetter: null,
  loadedAt: 0,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end(text);
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

async function fetchStocksForLetter(letter) {
  const endpoint = `https://api-en.cnbctv18.com/nodeapi/v1/markets/companies?letter=${letter}&limit=1000&offset=0&pagination=true`;
  const json = await fetchJson(endpoint);
  return json?.data?.values ?? [];
}

async function loadStocksByLetter(forceRefresh = false) {
  if (!forceRefresh && memoryCache.stocksByLetter) {
    return memoryCache.stocksByLetter;
  }

  if (!forceRefresh && fs.existsSync(STOCK_CACHE_FILE)) {
    const fileRaw = fs.readFileSync(STOCK_CACHE_FILE, 'utf-8');
    const parsed = safeJsonParse(fileRaw);
    if (parsed && typeof parsed === 'object') {
      memoryCache.stocksByLetter = parsed;
      memoryCache.loadedAt = Date.now();
      return parsed;
    }
  }

  const pairs = await Promise.all(
    LETTERS.map(async (letter) => [letter, await fetchStocksForLetter(letter)])
  );

  const stocksByLetter = Object.fromEntries(pairs);
  memoryCache.stocksByLetter = stocksByLetter;
  memoryCache.loadedAt = Date.now();

  fs.mkdirSync(path.dirname(STOCK_CACHE_FILE), { recursive: true });
  fs.writeFileSync(STOCK_CACHE_FILE, JSON.stringify(stocksByLetter, null, 2));
  return stocksByLetter;
}

async function handleApi(req, res, urlObj) {
  if (req.method === 'GET' && urlObj.pathname === '/api/stocks') {
    const forceRefresh = urlObj.searchParams.get('refresh') === '1';
    try {
      const stocksByLetter = await loadStocksByLetter(forceRefresh);
      return sendJson(res, 200, {
        ok: true,
        source: forceRefresh ? 'remote-refresh' : (fs.existsSync(STOCK_CACHE_FILE) ? 'cache-or-memory' : 'remote'),
        letters: Object.keys(stocksByLetter).length,
        data: stocksByLetter,
      });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/price') {
    const id = urlObj.searchParams.get('id');
    if (!id) {
      return sendJson(res, 400, { ok: false, error: 'id query parameter is required' });
    }

    try {
      const [nse, bse] = await Promise.all([
        fetchJson(`https://api-en.cnbctv18.com/nodeapi/v1/markets/equityCash?id=${encodeURIComponent(id)}&exchange=nse`),
        fetchJson(`https://api-en.cnbctv18.com/nodeapi/v1/markets/equityCash?id=${encodeURIComponent(id)}&exchange=bse`),
      ]);

      return sendJson(res, 200, { ok: true, id, nse, bse });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  return false;
}

function serveStatic(req, res, urlObj) {
  let filePath = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not Found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (urlObj.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, urlObj);
    if (handled !== false) {
      return;
    }
  }

  serveStatic(req, res, urlObj);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
