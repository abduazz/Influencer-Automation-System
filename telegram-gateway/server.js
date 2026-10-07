/**
 * Telegram MTProto User Gateway (Self-Hosted QR Code Login)
 * Connects directly to Telegram via MTProto as an authorized user account.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '34747233', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '22e627a9308edd6aabb1371ad5c0057b';
const PORT = parseInt(process.env.TELEGRAM_GATEWAY_PORT || '5005', 10);
const CANDIDATE_WEBHOOK_URLS = [
  process.env.LARAVEL_GATEWAY_WEBHOOK_URL,
  'http://127.0.0.1/api/telegram-gateway/webhook',
  'http://localhost/api/telegram-gateway/webhook',
  'http://127.0.0.1:8000/api/telegram-gateway/webhook',
  'http://127.0.0.1:8001/api/telegram-gateway/webhook',
  'http://127.0.0.1:8080/api/telegram-gateway/webhook',
].filter(Boolean);
const SESSION_FILE = path.resolve(__dirname, '../storage/app/telegram_user_session.json');

// Ensure directory exists
const sessionDir = path.dirname(SESSION_FILE);
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

let savedSessionString = '';
if (fs.existsSync(SESSION_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    savedSessionString = data.session || '';
  } catch (e) {
    console.error('Failed to read session file:', e.message);
  }
}

const stringSession = new StringSession(savedSessionString);
const client = new TelegramClient(stringSession, API_ID, API_HASH, {
  connectionRetries: 5,
});

let isAuthorized = false;
let currentUser = null;
let currentQr = null;
let qrLoginActive = false;
let messageListenerRegistered = false;

function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id ? user.id.toString() : null,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || null,
    phone: user.phone || null,
  };
}

async function saveSession() {
  const sessionStr = client.session.save();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ session: sessionStr, updatedAt: new Date().toISOString() }));
}

function clearSession() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      fs.unlinkSync(SESSION_FILE);
    } catch (e) {}
  }
  isAuthorized = false;
  currentUser = null;
  currentQr = null;
}

// Setup incoming message listener
function setupMessageListener() {
  if (messageListenerRegistered) return;
  messageListenerRegistered = true;

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message) return;

      // Extract sender info
      let sender = null;
      try {
        sender = await message.getSender();
      } catch (e) {}

      let chat = null;
      try {
        chat = await message.getChat();
      } catch (e) {}

      const payload = {
        messageId: message.id,
        isOutgoing: !!message.out,
        chatId: message.chatId ? message.chatId.toString() : null,
        peerId: message.peerId ? (message.peerId.userId || message.peerId.chatId || message.peerId.channelId || '').toString() : null,
        senderId: sender?.id ? sender.id.toString() : null,
        senderUsername: sender?.username || null,
        senderFirstName: sender?.firstName || null,
        senderLastName: sender?.lastName || null,
        chatUsername: chat?.username || null,
        chatTitle: chat?.title || null,
        text: message.message || message.text || '',
        date: message.date,
      };

      console.log('Incoming TG message:', payload.senderUsername, payload.text?.slice(0, 50));

      // Post to Laravel with fallback candidates
      (async () => {
        for (const url of CANDIDATE_WEBHOOK_URLS) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data && data.ok) {
              console.log(`Forwarded message to Laravel at ${url}`);
              return;
            }
          } catch (e) {
            // try next candidate
          }
        }
      })();
    } catch (err) {
      console.error('Error in message event handler:', err);
    }
  }, new NewMessage({}));
}

// Initialize Client
async function initClient() {
  try {
    await client.connect();
    isAuthorized = await client.isUserAuthorized();
    if (isAuthorized) {
      const me = await client.getMe();
      currentUser = formatUser(me);
      console.log('Telegram Gateway connected as:', currentUser.firstName, `(@${currentUser.username || currentUser.phone})`);
      setupMessageListener();
    } else {
      console.log('Telegram Gateway ready. Not authorized yet. Scan QR to connect.');
    }
  } catch (err) {
    console.error('Telegram init error:', err.message);
  }
}

// Start QR Login Process
async function startQrLogin() {
  if (isAuthorized) {
    return { isAuthorized: true, user: currentUser };
  }

  if (qrLoginActive && currentQr) {
    return { isAuthorized: false, qr: currentQr };
  }

  qrLoginActive = true;
  currentQr = null;

  (async () => {
    try {
      await client.signInUserWithQrCode(
        { apiId: API_ID, apiHash: API_HASH },
        {
          qrCode: async (code) => {
            const tokenBase64 = code.token.toString('base64url');
            const tgUrl = `tg://login?token=${tokenBase64}`;
            const dataUrl = await QRCode.toDataURL(tgUrl, {
              width: 300,
              margin: 2,
              color: { dark: '#000000', light: '#ffffff' },
            });

            currentQr = {
              tgUrl,
              dataUrl,
              expires: code.expires,
              updatedAt: Date.now(),
            };
            console.log('Generated new QR code token. Waiting for scan...');
          },
          onError: (err) => {
            console.error('QR callback error:', err.message);
          },
        }
      );

      // Successfully scanned and logged in!
      await saveSession();
      isAuthorized = true;
      const me = await client.getMe();
      currentUser = formatUser(me);
      currentQr = null;
      qrLoginActive = false;
      console.log('🎉 Successfully logged in via QR code as:', currentUser.firstName, `(@${currentUser.username})`);
      setupMessageListener();
    } catch (err) {
      console.error('QR Login stopped/failed:', err.message);
      currentQr = null;
      qrLoginActive = false;
    }
  })();

  // Wait a moment for first QR code generation
  let attempts = 0;
  while (!currentQr && attempts < 15) {
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }

  return { isAuthorized: false, qr: currentQr };
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const readBody = () => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  };

  try {
    // 1. GET /status
    if (url.pathname === '/status' && req.method === 'GET') {
      return sendJson(200, {
        isAuthorized,
        user: currentUser,
        qr: currentQr,
        qrLoginActive,
      });
    }

    // 2. POST /qr/start
    if (url.pathname === '/qr/start' && req.method === 'POST') {
      const result = await startQrLogin();
      return sendJson(200, result);
    }

    // 3. POST /logout
    if (url.pathname === '/logout' && req.method === 'POST') {
      try {
        await client.logOut();
      } catch (e) {}
      clearSession();
      return sendJson(200, { success: true, message: 'Logged out successfully' });
    }

    // 4. POST /send
    if (url.pathname === '/send' && req.method === 'POST') {
      if (!isAuthorized) {
        return sendJson(401, { error: 'Telegram gateway is not authorized. Scan QR code first.' });
      }

      const body = await readBody();
      let target = body.to || body.chatId || body.username;
      const text = body.text;

      if (!target || !text) {
        return sendJson(400, { error: 'Target (to) and text are required' });
      }

      // Format username if string without @
      if (typeof target === 'string' && !target.startsWith('@') && !target.startsWith('-') && isNaN(Number(target))) {
        target = `@${target}`;
      } else if (!isNaN(Number(target))) {
        target = Number(target);
      }

      try {
        const result = await client.sendMessage(target, { message: text });
        return sendJson(200, {
          success: true,
          messageId: result.id,
          date: result.date,
        });
      } catch (err) {
        console.error('Send error:', err);
        return sendJson(500, { error: err.message || 'Failed to send message via Telegram' });
      }
    }

    sendJson(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Server error:', err);
    sendJson(500, { error: err.message });
  }
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Telegram MTProto Gateway running on http://127.0.0.1:${PORT}`);
  initClient();
});
