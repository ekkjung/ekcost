import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'ek-production-tech-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: true, 
    sameSite: 'none',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Google OAuth Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Auth Endpoints
app.get('/api/auth/google/url', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ url: authUrl });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    // Store tokens in session
    (req.session as any).tokens = tokens;
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens', error);
    res.status(500).send('Authentication failed');
  }
});

// Sheets API Endpoints
app.get('/api/sheets/sync', async (req, res) => {
  const tokens = (req.session as any).tokens;
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  oauth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A2:P', // Adjust range as needed
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ items: [] });
    }

    // Map rows to CostItem structure
    const items = rows.map((row, index) => ({
      // We don't have a stable ID in Sheets unless we add one. 
      // For sync, we might need to match by fields or add an ID column.
      // For now, let's just return the data.
      year: Number(row[0]),
      month: Number(row[1]),
      day: Number(row[2]),
      category: row[3],
      processModel: row[4],
      processName: row[5],
      equipmentName: row[6],
      itemName: row[7],
      itemNumber: row[8],
      supplier: row[9],
      manufacturer: row[10],
      quantity: Number(row[11]),
      unitPrice: Number(row[12]),
      totalAmount: Number(row[13]),
      isPlanned: row[14] === '계획',
      createdAt: row[15] || new Date().toISOString(),
    }));

    res.json({ items });
  } catch (error) {
    console.error('Error fetching sheets data', error);
    res.status(500).json({ error: 'Failed to fetch data from Google Sheets' });
  }
});

app.post('/api/sheets/append', async (req, res) => {
  const tokens = (req.session as any).tokens;
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items data' });
  }

  oauth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  const values = items.map(item => [
    item.year,
    item.month,
    item.day,
    item.category,
    item.processModel,
    item.processName,
    item.equipmentName,
    item.itemName,
    item.itemNumber,
    item.supplier,
    item.manufacturer,
    item.quantity,
    item.unitPrice,
    item.totalAmount,
    item.isPlanned ? '계획' : '사용',
    item.createdAt || new Date().toISOString()
  ]);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error appending to sheets', error);
    res.status(500).json({ error: 'Failed to append data to Google Sheets' });
  }
});

// Vite Middleware
async function startServer() {
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
}

startServer();
