import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { google } from 'googleapis';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

// Google OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'ledger-alpha-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// API Routes
app.get('/api/auth/url', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/spreadsheets'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({ url });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (typeof code !== 'string') {
    return res.status(400).send('Invalid code');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens in session (In production use a database)
    (req.session as any).tokens = tokens;

    res.send(`
      <html>
        <body style="font-family: monospace; background: #000; color: #0f0; display: flex; align-items: center; justify-content: center; height: 100vh;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <div style="text-align: center;">
            <p>AUTH_COMPLETE. ENCRYPTED_HANDSHAKE_SUCCESS.</p>
            <p>CLOSING_WINDOW...</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({ isAuthenticated: !!(req.session as any).tokens });
});

app.post('/api/gsheets/import', async (req, res) => {
  const tokens = (req.session as any).tokens;
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

  const { spreadsheetId, range } = req.body;
  if (!spreadsheetId) return res.status(400).json({ error: 'Spreadsheet ID required' });

  oauth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range || 'Sheet1!A1:H1000',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ transactions: [] });
    }

    // Basic CSV-like parsing (assuming first row is header)
    const headers = rows[0];
    const transactions = rows.slice(1).map((row, index) => {
      const t: any = { id: `gs-${Date.now()}-${index}` };
      headers.forEach((header, i) => {
        const value = row[i];
        if (!value) return;
        const h = header.toLowerCase();
        
        if (h.includes('date')) t.date = value;
        else if (h.includes('person')) t.person = value;
        else if (h.includes('type')) t.type = value;
        else if (h.includes('main')) t.mainCategory = value;
        else if (h.includes('sub')) t.subCategory = value;
        else if (h.includes('desc')) t.description = value;
        else if (h.includes('bank')) t.bank = value;
        else if (h.includes('mode')) t.mode = value;
        else if (h.includes('out') || h.includes('dr')) t.dr = parseFloat(value.replace(/,/g, '') || '0');
        else if (h.includes('in') || h.includes('cr')) t.cr = parseFloat(value.replace(/,/g, '') || '0');
        else if (h.includes('nature')) t.nature = value;
      });
      // Set defaults for missing fields to avoid undefined errors
      t.person = t.person || 'Suyash';
      t.type = t.type || 'Variable';
      t.dr = t.dr || 0;
      t.cr = t.cr || 0;
      t.nature = t.nature || '';
      return t;
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Error fetching sheets data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// ─── PUBLIC Sheet Import (no OAuth needed for shared sheets) ────────
app.post('/api/gsheets/public-import', async (req, res) => {
  const { spreadsheetId } = req.body;
  if (!spreadsheetId) return res.status(400).json({ error: 'Spreadsheet ID required' });

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) return res.status(400).json({ error: `Failed to fetch sheet (${csvRes.status}). Make sure the sheet is shared as "Anyone with the link".` });

    const csvText = await csvRes.text();
    const lines = csvText.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
    if (lines.length < 2) return res.json({ transactions: [] });

    // Parse CSV (handles quoted fields)
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let cell = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(cell.trim());
          cell = '';
        } else {
          cell += ch;
        }
      }
      result.push(cell.trim());
      return result;
    }

    const headers = parseCSVLine(lines[0]);
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue; // skip empty rows

      const t: any = { id: `pub-${Date.now()}-${i}` };
      headers.forEach((header, idx) => {
        const val = cols[idx] || '';
        const h = header.toLowerCase();
        if (h.includes('date')) t.date = val;
        else if (h.includes('person')) t.person = val;
        else if (h.includes('type')) t.type = val;
        else if (h.includes('main')) t.mainCategory = val;
        else if (h.includes('sub')) t.subCategory = val;
        else if (h.includes('desc')) t.description = val;
        else if (h.includes('bank')) t.bank = val;
        else if (h.includes('mode')) t.mode = val;
        else if (h.includes('out') || h.includes('dr')) t.dr = parseFloat((val || '0').replace(/,/g, '')) || 0;
        else if (h.includes('in') || h.includes('cr')) t.cr = parseFloat((val || '0').replace(/,/g, '')) || 0;
        else if (h.includes('nature')) t.nature = val;
      });
      t.person = t.person || 'Suyash';
      t.type = t.type || 'Variable';
      t.mainCategory = t.mainCategory || '';
      t.subCategory = t.subCategory || '';
      t.description = t.description || '';
      t.bank = t.bank || '';
      t.mode = t.mode || '';
      t.dr = t.dr || 0;
      t.cr = t.cr || 0;
      t.nature = t.nature || '';
      transactions.push(t);
    }

    console.log(`✅ Public import: ${transactions.length} rows from sheet ${spreadsheetId}`);
    res.json({ transactions });
  } catch (error) {
    console.error('Public import error:', error);
    res.status(500).json({ error: 'Failed to fetch sheet data' });
  }
});

// ─── LIVE MARKET PRICES ─────────────────────────────────────────────
// Cache prices for 15 minutes to avoid excessive API calls
let priceCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 min

// Stock symbol mapping (user's portfolio → Yahoo Finance symbols)
const STOCK_SYMBOLS: Record<string, string> = {
  'IRCTC': 'IRCTC.NS',
  'RVNL': 'RVNL.NS',
  'Suzlon': 'SUZLON.NS',
  'Bank of Baroda': 'BANKBARODA.NS',
  'Meesho': 'MEESHO.NS',
  'Silver ETF': 'ICICIPRUSL.NS',
  'TATSILV': 'TATASILV.NS',
};

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch { return null; }
}

async function fetchGeminiPrices(apiKey: string, symbols: string[]): Promise<Record<string, number>> {
  try {
    const prompt = `You are a market data assistant. Return ONLY a valid JSON object with current approximate market prices in INR for these Indian stocks/assets. No explanation, no markdown, just the JSON.

Stocks: ${symbols.join(', ')}
Also include: "gold_per_gram_24k" (current 24K gold price per gram in India in INR), "gold_per_tola" (current 24K gold price per tola in INR)

Format: {"IRCTC": 750, "RVNL": 400, "gold_per_gram_24k": 7500, "gold_per_tola": 87500, ...}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0 },
          tools: [{ googleSearch: {} }]
        })
      }
    );
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (e) {
    console.error('Gemini prices error:', e);
    return {};
  }
}

app.post('/api/market/prices', async (req, res) => {
  const { apiKey } = req.body;

  // Check cache
  if (priceCache && (Date.now() - priceCache.timestamp) < CACHE_TTL) {
    return res.json(priceCache.data);
  }

  const result: Record<string, any> = {
    stocks: {} as Record<string, number>,
    gold: { perGram: 0, perTola: 0 },
    source: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Strategy 1: Try Yahoo Finance for each stock
  let yahooSuccess = 0;
  for (const [name, symbol] of Object.entries(STOCK_SYMBOLS)) {
    if (!symbol) continue;
    const price = await fetchYahooPrice(symbol);
    if (price) {
      result.stocks[name] = price;
      yahooSuccess++;
    }
  }

  // Try Yahoo for gold (MCX Gold)
  const goldPrice = await fetchYahooPrice('GC=F');
  if (goldPrice) {
    // GC=F is USD per troy ounce. Convert to INR per gram
    const usdToInr = 85; // approximate
    result.gold.perGram = Math.round((goldPrice / 31.1035) * usdToInr);
    result.gold.perTola = Math.round(result.gold.perGram * 11.664);
    result.source = 'yahoo';
  }

  // Strategy 2: If Yahoo failed for most stocks, try Gemini
  if (yahooSuccess < 3 && apiKey) {
    console.log('Yahoo had gaps, falling back to Gemini for prices...');
    const stockNames = Object.keys(STOCK_SYMBOLS);
    const geminiPrices = await fetchGeminiPrices(apiKey, stockNames);

    for (const [name] of Object.entries(STOCK_SYMBOLS)) {
      if (!result.stocks[name] && geminiPrices[name]) {
        result.stocks[name] = geminiPrices[name];
      }
    }
    if (geminiPrices.gold_per_gram_24k && !result.gold.perGram) {
      result.gold.perGram = geminiPrices.gold_per_gram_24k;
      result.gold.perTola = geminiPrices.gold_per_tola || Math.round(geminiPrices.gold_per_gram_24k * 11.664);
    }
    result.source = yahooSuccess > 0 ? 'yahoo+gemini' : 'gemini';
  }

  console.log(`📈 Market prices fetched (${result.source}): ${Object.keys(result.stocks).length} stocks, gold ₹${result.gold.perGram}/g`);

  // Cache result
  priceCache = { data: result, timestamp: Date.now() };
  res.json(result);
});

// Gemini AI CFO Chat endpoint
app.post('/api/gemini/chat', async (req, res) => {
  const { message, context, history = [], apiKey: clientKey } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(400).json({ error: 'Gemini API key not set. Click the 🔑 icon to add your key.' });
  }

  try {
    // Build multi-turn contents array
    // System context goes as first user turn
    const contents: any[] = [
      { role: 'user', parts: [{ text: context }] },
      { role: 'model', parts: [{ text: 'Understood. I have reviewed the family ledger context. Ready to assist as CFO.' }] },
    ];

    // Append conversation history for memory
    for (const h of history) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      });
    }

    // Current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          systemInstruction: {
            parts: [{ text: 'You are a sharp Personal CFO for an Indian family. When you are unsure about an entry, wrap your clarifying question in [QUESTION: your question here]. Use ₹ for currency. Be concise and data-driven.' }]
          }
        })
      }
    );
    const data = await response.json();
    if (data.error) {
      console.error('Gemini API error response:', data.error);
      return res.status(500).json({ error: data.error.message || 'Gemini API error' });
    }
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    res.json({ reply });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: 'Gemini request failed' });
  }
});

// Named Sheets registry (server-side session storage)
app.get('/api/sheets/list', (req, res) => {
  const sheets = (req.session as any).sheets || [];
  res.json({ sheets });
});

app.post('/api/sheets/save', (req, res) => {
  const { sheets } = req.body;
  (req.session as any).sheets = sheets;
  res.json({ ok: true });
});

// Vite middleware setup
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
