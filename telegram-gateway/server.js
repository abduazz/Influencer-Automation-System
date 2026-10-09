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

// Load .env from project root if exists
const ENV_FILE = path.resolve(__dirname, '../.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    for (const rawLine of envContent.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse .env file:', e.message);
  }
}

// Configuration
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '34747233', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '22e627a9308edd6aabb1371ad5c0057b';
const PORT = parseInt(process.env.TELEGRAM_GATEWAY_PORT || '5005', 10);

const appUrlWebhook = process.env.APP_URL 
  ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/telegram-gateway/webhook` 
  : null;

const CANDIDATE_WEBHOOK_URLS = Array.from(new Set([
  process.env.LARAVEL_GATEWAY_WEBHOOK_URL,
  appUrlWebhook,
  'https://tezi.uz/api/telegram-gateway/webhook',
  'http://127.0.0.1/api/telegram-gateway/webhook',
  'http://localhost/api/telegram-gateway/webhook',
  'http://127.0.0.1:8000/api/telegram-gateway/webhook',
  'http://127.0.0.1:8001/api/telegram-gateway/webhook',
  'http://127.0.0.1:8080/api/telegram-gateway/webhook',
].filter(Boolean)));
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
let recentUpdates = [];

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
        timestamp: Date.now(),
      };

      // Store in memory queue for direct pull polling
      recentUpdates.unshift(payload);
      if (recentUpdates.length > 100) {
        recentUpdates = recentUpdates.slice(0, 100);
      }

      console.log('Incoming TG message:', payload.senderUsername, payload.text?.slice(0, 50));

      // Post to Laravel with fallback candidates
      (async () => {
        for (const url of CANDIDATE_WEBHOOK_URLS) {
          try {
            let res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(payload),
              redirect: 'manual',
            });

            // If server returned a redirect (e.g. HTTP -> HTTPS 301/302), follow to location with POST
            if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
              const redirectUrl = res.headers.get('location');
              if (redirectUrl) {
                res = await fetch(redirectUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  body: JSON.stringify(payload),
                });
              }
            }

            const data = await res.json().catch(() => null);
            if (res.ok && data && data.ok) {
              console.log(`Forwarded message to Laravel at ${url}`);
              return;
            } else {
              console.log(`Webhook responded with status ${res.status} at ${url}`);
            }
          } catch (e) {
            console.log(`Webhook error at ${url}: ${e.message}`);
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

      // Format username or ID (strip t.me/ links)
      if (typeof target === 'string') {
        target = target.trim();
        target = target.replace(/^(https?:\/\/)?(t\.me\/)/i, '');
        if (!target.startsWith('@') && !target.startsWith('-') && !target.startsWith('+') && isNaN(Number(target))) {
          target = `@${target}`;
        } else if (!isNaN(Number(target))) {
          target = Number(target);
        }
      }

      try {
        const result = await client.sendMessage(target, { message: text });
        let peerId = null;
        if (result.peerId) {
          peerId = (result.peerId.userId || result.peerId.chatId || result.peerId.channelId || '').toString();
        }
        return sendJson(200, {
          success: true,
          messageId: result.id,
          date: result.date,
          peerId: peerId,
        });
      } catch (err) {
        console.error('Send error:', err);
        return sendJson(500, { error: err.message || 'Failed to send message via Telegram' });
      }
    }

    // 5. GET /updates - Retrieve recent incoming updates from in-memory queue
    if (url.pathname === '/updates' && req.method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10);
      const filtered = since > 0 ? recentUpdates.filter(u => u.timestamp > since) : recentUpdates;
      return sendJson(200, {
        success: true,
        updates: filtered,
        serverTime: Date.now(),
      });
    }

    // 6. POST /history - Fetch recent message history directly from Telegram MTProto
    if (url.pathname === '/history' && req.method === 'POST') {
      if (!isAuthorized) {
        return sendJson(401, { error: 'Telegram gateway is not authorized.' });
      }

      const body = await readBody();
      let target = body.target || body.username || body.chatId;
      if (!target) {
        return sendJson(400, { error: 'Target is required' });
      }

      if (typeof target === 'string') {
        target = target.trim();
        target = target.replace(/^(https?:\/\/)?(t\.me\/)/i, '');
        if (!target.startsWith('@') && !target.startsWith('-') && !target.startsWith('+') && isNaN(Number(target))) {
          target = `@${target}`;
        } else if (!isNaN(Number(target))) {
          target = Number(target);
        }
      }

      try {
        const messages = await client.getMessages(target, { limit: 25 });
        const list = [];
        for (const m of messages) {
          if (!m || !m.id) continue;
          let mSender = null;
          try { mSender = await m.getSender(); } catch (e) {}
          let mChat = null;
          try { mChat = await m.getChat(); } catch (e) {}

          list.push({
            messageId: m.id,
            isOutgoing: !!m.out,
            chatId: m.chatId ? m.chatId.toString() : null,
            peerId: m.peerId ? (m.peerId.userId || m.peerId.chatId || m.peerId.channelId || '').toString() : null,
            senderId: mSender?.id ? mSender.id.toString() : null,
            senderUsername: mSender?.username || null,
            senderFirstName: mSender?.firstName || null,
            senderLastName: mSender?.lastName || null,
            chatUsername: mChat?.username || null,
            chatTitle: mChat?.title || null,
            text: m.message || m.text || '',
            date: m.date,
          });
        }
        return sendJson(200, { success: true, messages: list });
      } catch (err) {
        console.error('Fetch history error:', err.message);
        return sendJson(500, { error: err.message });
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
