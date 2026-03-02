const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const lettersEl = document.getElementById('letters');
const statusEl = document.getElementById('stocksStatus');
const stocksListEl = document.getElementById('stocksList');
const stockDetailsEl = document.getElementById('stockDetails');
const selectedLetterHeading = document.getElementById('selectedLetterHeading');
const stockFilterEl = document.getElementById('stockFilter');
const refreshStocksBtn = document.getElementById('refreshStocks');

let stocksByLetter = {};
let selectedLetter = 'A';

function setStatus(message) {
  statusEl.textContent = message;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 'Not available';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(number);
}

function parseLatestPrice(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidates = [
    payload.data?.pricecurrent,
    payload.data?.lastprice,
    payload.data?.price,
    payload.data?.ltp,
    payload.data?.currentPrice,
    payload.pricecurrent,
    payload.lastprice,
    payload.price,
    payload.ltp,
  ];

  return candidates.find((item) => Number.isFinite(Number(item))) ?? null;
}

async function loadAllStocks(forceRefresh = false) {
  const query = forceRefresh ? '?refresh=1' : '';
  const response = await fetch(`/api/stocks${query}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stock directory (${response.status})`);
  }

  const payload = await response.json();
  if (!payload.ok || !payload.data) {
    throw new Error(payload.error || 'Invalid stocks API response');
  }

  stocksByLetter = payload.data;
  setStatus(`Loaded A–Z data from ${payload.source}.`);
  renderStocks(selectedLetter);
}

function renderLetters() {
  lettersEl.innerHTML = '';
  LETTERS.forEach((letter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = letter;
    if (letter === selectedLetter) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      selectedLetter = letter;
      [...lettersEl.querySelectorAll('button')].forEach((item) => {
        item.classList.toggle('active', item.textContent === letter);
      });
      renderStocks(letter);
    });

    lettersEl.appendChild(btn);
  });
}

function renderStocks(letter) {
  const query = stockFilterEl.value.trim().toLowerCase();
  const allStocks = stocksByLetter[letter] || [];
  const filtered = allStocks
    .filter((stock) => stock.companyName?.toLowerCase().includes(query))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  selectedLetterHeading.textContent = `Stocks: ${letter} (${filtered.length})`;
  stocksListEl.innerHTML = '';

  if (!filtered.length) {
    stocksListEl.innerHTML = '<li><small>No stocks found for this letter/filter.</small></li>';
    return;
  }

  filtered.forEach((stock) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<strong>${stock.companyName}</strong><br><small>${stock.exchangeSymbol || 'N/A'} • ${stock.moneycontrolCompanyCode || 'No code'}</small>`;
    btn.addEventListener('click', () => showStockPrice(stock));
    li.appendChild(btn);
    stocksListEl.appendChild(li);
  });
}

async function showStockPrice(stock) {
  const code = stock.moneycontrolCompanyCode;
  if (!code) {
    stockDetailsEl.innerHTML = '<p>This stock has no moneycontrolCompanyCode.</p>';
    return;
  }

  stockDetailsEl.innerHTML = `<p>Loading latest prices for <strong>${stock.companyName}</strong>...</p>`;

  try {
    const response = await fetch(`/api/price?id=${encodeURIComponent(code)}`);
    if (!response.ok) {
      throw new Error(`Price API failed (${response.status})`);
    }

    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || 'Invalid price response');
    }

    const nsePrice = formatCurrency(parseLatestPrice(payload.nse));
    const bsePrice = formatCurrency(parseLatestPrice(payload.bse));

    stockDetailsEl.innerHTML = `
      <h3>${stock.companyName}</h3>
      <p><small>Code: ${code} | Symbol: ${stock.exchangeSymbol || 'N/A'}</small></p>
      <div class="price-grid">
        <div class="price-box"><h3>NSE</h3><p><strong>${nsePrice}</strong></p></div>
        <div class="price-box"><h3>BSE</h3><p><strong>${bsePrice}</strong></p></div>
      </div>
    `;
  } catch (error) {
    stockDetailsEl.innerHTML = `<p>Unable to load latest prices. ${error.message}</p>`;
  }
}

stockFilterEl.addEventListener('input', () => renderStocks(selectedLetter));
refreshStocksBtn.addEventListener('click', () => {
  setStatus('Refreshing stock data from remote API...');
  loadAllStocks(true).catch((error) => setStatus(`Error: ${error.message}`));
});

async function init() {
  renderLetters();
  setStatus('Loading stock directory...');
  try {
    await loadAllStocks(false);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

init();
