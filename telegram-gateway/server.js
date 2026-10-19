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
import { ConnectionTCPObfuscated } from 'telegram/network/index.js';

const GATEWAY_VERSION = '2.1.0';
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
const rawPort = process.env.TELEGRAM_GATEWAY_PORT;
const PORT = (rawPort === '5005' || !rawPort) ? 5006 : parseInt(rawPort, 10);

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
  connection: ConnectionTCPObfuscated,
  connectionRetries: 5,
  requestRetries: 2,
  timeout: 10,
  autoReconnect: true,
});

function withTimeout(promise, ms, errorMsg = 'Operation timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

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

/**
 * Normalizes and extracts phone number or phone link:
 * - "+79771730800" -> "+79771730800"
 * - "79771730800" -> "+79771730800"
 * - "89771730800" -> "+79771730800"
 * - "https://t.me/+79771730800" -> "+79771730800"
 * - "+998933362233" -> "+998933362233"
 */
function extractPhoneNumber(input) {
  if (!input) return null;
  let clean = String(input).trim();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(?:\+)?/i, '+');
  clean = clean.replace(/^tg:\/\/resolve\?(?:phone=|\+)/i, '+');

  if (clean.startsWith('+')) {
    const digits = clean.slice(1).replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 16) {
      return `+${digits}`;
    }
    return null;
  }

  const digitsOnly = clean.replace(/\D/g, '');
  const hasLetters = /[a-zA-Z_]/.test(clean);
  if (hasLetters) {
    return null;
  }

  // Uzbekistan mobile: 998 + 9 digits = 12 digits (e.g. 998995962233)
  if (digitsOnly.length === 12 && digitsOnly.startsWith('998')) {
    return `+${digitsOnly}`;
  }

  // Russia / Kazakhstan mobile: 11 digits starting with 79, 89, 77, 87
  if (digitsOnly.length === 11) {
    if (digitsOnly.startsWith('89') || digitsOnly.startsWith('87')) {
      return `+7${digitsOnly.slice(1)}`;
    }
    if (digitsOnly.startsWith('79') || digitsOnly.startsWith('77')) {
      return `+${digitsOnly}`;
    }
  }

  // 9, 10 or arbitrary digit strings (such as Telegram User IDs 1122243813 or 8857588390)
  // are Telegram Chat/User IDs, NOT phone numbers!
  return null;
}

/**
 * Resolves a phone number to an active Telegram User using MTProto ImportContacts
 */
async function resolvePhoneUser(phone, contactName = 'Blogger') {
  try {
    const randomId = BigInt(Math.floor(Math.random() * 1000000000));
    const contact = new Api.InputPhoneContact({
      clientId: randomId,
      phone: phone,
      firstName: contactName || 'Blogger',
      lastName: '',
    });

    const res = await withTimeout(
      client.invoke(new Api.contacts.ImportContacts({
        contacts: [contact],
      })),
      7000,
      'Поиск контакта в Telegram превысил таймаут (7 сек).'
    );

    if (res && res.users && res.users.length > 0) {
      const user = res.users[0];
      return {
        found: true,
        user: user,
        id: user.id ? user.id.toString() : null,
        username: user.username || null,
        firstName: user.firstName || '',
        phone: user.phone || phone,
      };
    }

    return { found: false, phone };
  } catch (err) {
    console.error(`[GATEWAY] ImportContacts error for phone ${phone}:`, err.message);
    return { found: false, phone, error: err.message };
  }
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

// Extract media metadata without saving to disk (100% zero-disk & confidential)
function extractMediaMetadata(message) {
  if (!message || !message.media) {
    return { mediaType: null, mediaDuration: null, mediaFilename: null };
  }

  let mediaType = null;
  let mediaFilename = null;
  let mediaDuration = null;

  try {
    const media = message.media;
    if (media.className === 'MessageMediaPhoto' || media.photo) {
      mediaType = 'photo';
    } else if (media.className === 'MessageMediaDocument' || media.document) {
      const doc = media.document;
      if (doc) {
        const isVoice = doc.attributes?.some(attr => 
          (attr.className === 'DocumentAttributeAudio' || attr.voice) && !!attr.voice
        );
        const audioAttr = doc.attributes?.find(attr => 
          attr.className === 'DocumentAttributeAudio' || attr.duration !== undefined
        );
        const videoAttr = doc.attributes?.find(attr => 
          attr.className === 'DocumentAttributeVideo'
        );
        const filenameAttr = doc.attributes?.find(attr => 
          attr.className === 'DocumentAttributeFilename'
        );

        if (isVoice) {
          mediaType = 'voice';
          mediaDuration = audioAttr?.duration || 0;
        } else if (doc.mimeType?.startsWith('image/')) {
          mediaType = 'photo';
        } else if (videoAttr || doc.mimeType?.startsWith('video/')) {
          mediaType = 'video';
          mediaDuration = videoAttr?.duration || 0;
        } else if (audioAttr || doc.mimeType?.startsWith('audio/')) {
          mediaType = 'audio';
          mediaDuration = audioAttr?.duration || 0;
        } else {
          mediaType = 'document';
          mediaFilename = filenameAttr?.fileName || 'Документ';
        }
      }
    }
  } catch (err) {
    console.error(`[GATEWAY] Error reading media metadata for msg ${message?.id}:`, err.message);
  }

  return { mediaType, mediaDuration, mediaFilename };
}

// Setup incoming message listener
function setupMessageListener() {
  if (messageListenerRegistered) return;
  messageListenerRegistered = true;

  client.addEventHandler(async (event) => {
    try {
      // 1. Read receipts: blogger read messages in Telegram (UpdateReadHistoryOutbox / UpdateReadChannelOutbox)
      if (event.className === 'UpdateReadHistoryOutbox' || event.className === 'UpdateReadChannelOutbox') {
        const maxId = event.maxId;
        const peerId = (event.peer?.userId || event.peer?.chatId || event.peer?.channelId || event.channelId || '').toString();
        console.log(`[GATEWAY] 👁️ Messages read by peer ${peerId} up to msgId ${maxId}`);
        const readPayload = {
          type: 'read_history',
          peerId: peerId,
          maxId: maxId,
          readAt: Math.floor(Date.now() / 1000),
          timestamp: Date.now(),
        };

        for (const url of CANDIDATE_WEBHOOK_URLS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(readPayload),
            });
            break;
          } catch (e) {}
        }
        return;
      }

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

      // Extract media metadata (zero disk usage, 100% confidential)
      let mediaType = null;
      let mediaDuration = null;
      let mediaFilename = null;

      if (message.media) {
        try {
          const mInfo = extractMediaMetadata(message);
          mediaType = mInfo.mediaType;
          mediaDuration = mInfo.mediaDuration;
          mediaFilename = mInfo.mediaFilename;
        } catch (e) {
          console.error('[GATEWAY] Error reading incoming media metadata:', e.message);
        }
      }

      let text = message.message || message.text || '';
      if (!text && mediaType) {
        if (mediaType === 'voice') {
          text = `🎤 Голосовое сообщение${mediaDuration ? ` (${Math.floor(mediaDuration / 60)}:${String(mediaDuration % 60).padStart(2, '0')})` : ''}`;
        } else if (mediaType === 'photo') {
          text = '📷 Фотография';
        } else if (mediaType === 'video') {
          text = `🎥 Видеозапись${mediaDuration ? ` (${Math.floor(mediaDuration / 60)}:${String(mediaDuration % 60).padStart(2, '0')})` : ''}`;
        } else if (mediaType === 'audio') {
          text = `🎵 Аудиофайл${mediaDuration ? ` (${Math.floor(mediaDuration / 60)}:${String(mediaDuration % 60).padStart(2, '0')})` : ''}`;
        } else {
          text = `📄 ${mediaFilename || 'Документ'}`;
        }
      }

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
        text: text,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        mediaDuration: mediaDuration,
        mediaFilename: mediaFilename,
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

let lastAuthCheckTime = 0;

// Notify Laravel webhook when session is unlinked or lost
async function notifyLaravelSessionLost(reason) {
  for (const url of CANDIDATE_WEBHOOK_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          event: 'session_lost',
          reason: reason,
          timestamp: Date.now(),
        }),
      });
      if (res.ok) {
        console.log(`🚨 Notified Laravel about Telegram session disconnect at ${url}`);
        return;
      }
    } catch (e) {}
  }
}

// Handle unexpected session disconnection / revocation
async function handleSessionLost(reason) {
  if (!isAuthorized && !currentUser) return;
  console.warn(`🚨 [GATEWAY] Telegram session lost / unlinked by Telegram: ${reason}`);
  isAuthorized = false;
  currentUser = null;
  clearSession();

  // Notify Laravel backend immediately so admin gets alerted
  await notifyLaravelSessionLost(reason);

  // Automatically initiate QR login in background so fresh QR is immediately ready for admin
  startQrLogin().catch((err) => console.error('Auto-start QR login failed:', err?.message));
}

// Actively verify authorization status (throttled to at most once per 15s)
async function verifyAuthorization() {
  if (!isAuthorized) return false;
  const now = Date.now();
  if (now - lastAuthCheckTime < 15000) {
    return isAuthorized;
  }
  lastAuthCheckTime = now;

  try {
    const authValid = await withTimeout(
      client.isUserAuthorized(),
      4000,
      'Auth check timed out'
    );
    if (!authValid) {
      await handleSessionLost('client.isUserAuthorized() returned false (session invalidated)');
      return false;
    }
    return true;
  } catch (err) {
    const msg = String(err?.message || '');
    if (
      msg.includes('AUTH_KEY_UNREGISTERED') ||
      msg.includes('SESSION_REVOKED') ||
      msg.includes('SESSION_EXPIRED') ||
      msg.includes('USER_DEACTIVATED') ||
      msg.includes('401')
    ) {
      await handleSessionLost(`Auth key revoked: ${msg}`);
      return false;
    }
    return isAuthorized;
  }
}

// Periodic background authorization verification (every 30 seconds)
setInterval(() => {
  if (isAuthorized) {
    verifyAuthorization().catch(() => {});
  }
}, 30000);

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

  const readBody = (timeoutMs = 5000) => {
    return new Promise((resolve) => {
      let body = '';
      const timer = setTimeout(() => {
        console.warn(`[GATEWAY] readBody timeout reached (${timeoutMs}ms)`);
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      }, timeoutMs);

      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) {
          clearTimeout(timer);
          req.destroy();
          resolve({});
        }
      });

      req.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        console.error('[GATEWAY] req socket error in readBody:', err.message);
        resolve({});
      });
    });
  };

  try {
    // 1. GET /status
    if (url.pathname === '/status' && req.method === 'GET') {
      if (isAuthorized) {
        verifyAuthorization().catch(() => {});
      }
      return sendJson(200, {
        version: GATEWAY_VERSION,
        uptime: Math.floor(process.uptime()),
        connectionType: 'ConnectionTCPObfuscated',
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

    // 3.1 POST /restart - Gracefully restart microservice
    if (url.pathname === '/restart' && req.method === 'POST') {
      console.log('[GATEWAY] Restart request received. Exiting for process manager restart...');
      sendJson(200, { success: true, message: 'Telegram Gateway restarting...' });
      setTimeout(() => {
        process.exit(0);
      }, 200);
      return;
    }

    // 4. POST /send
    if (url.pathname === '/send' && req.method === 'POST') {
      const startTime = Date.now();
      console.log('[GATEWAY] 📨 Incoming POST /send request');

      if (!isAuthorized) {
        console.warn('[GATEWAY] /send rejected: gateway not authorized');
        return sendJson(401, { error: 'Telegram gateway is not authorized. Scan QR code first.' });
      }

      const body = await readBody(5000);
      let target = body.to || body.chatId || body.username || body.phone;
      const text = body.text;
      const bloggerName = body.bloggerName || body.senderName || 'Blogger';

      console.log(`[GATEWAY] /send payload:`, {
        to: body.to,
        username: body.username,
        phone: body.phone,
        chatId: body.chatId,
        target: target,
        bloggerName: bloggerName,
        textLen: text ? text.length : 0,
      });

      // 1. If an explicit valid public username is provided, prioritize it
      if (body.username && typeof body.username === 'string') {
        const u = body.username.trim();
        if (/[a-zA-Z]/.test(u) && !u.startsWith('+')) {
          target = u.startsWith('@') ? u : `@${u}`;
        }
      }

      if (!target || !text) {
        return sendJson(400, { error: 'Target (to) and text are required' });
      }

      let resolvedPeer = null;
      let resolvedUsername = null;
      let isPhoneTarget = false;
      const detectedPhone = extractPhoneNumber(body.phone || target);

      // 2. If target or phone field is a phone number, resolve via MTProto ImportContacts
      // Phone resolution is authoritative, so resolve regardless of whether chatId was passed!
      if (detectedPhone) {
        isPhoneTarget = true;
        console.log(`[GATEWAY] Target is phone (${detectedPhone}). Resolving via MTProto ImportContacts...`);
        const phoneResult = await resolvePhoneUser(detectedPhone, bloggerName);
        if (phoneResult.found && phoneResult.user) {
          console.log(`[GATEWAY] Phone ${detectedPhone} resolved to User ID: ${phoneResult.id} (@${phoneResult.username || 'no_user'})`);
          resolvedPeer = phoneResult.user;
          resolvedUsername = phoneResult.username;
        } else {
          console.warn(`[GATEWAY] Phone ${detectedPhone} not registered in Telegram or hidden by user privacy.`);
          // If we also have a public username, fallback to username instead of failing!
          if (body.username && typeof body.username === 'string' && /[a-zA-Z]/.test(body.username)) {
            const u = body.username.trim();
            target = u.startsWith('@') ? u : `@${u}`;
            console.log(`[GATEWAY] Falling back to username: ${target}`);
          } else {
            return sendJson(404, {
              error: `Номер ${detectedPhone} не зарегистрирован в Telegram (или пользователь скрыл аккаунт в настройках приватности). Проверьте правильность номера или укажите публичный @username блогера.`,
              notFound: true,
              phone: detectedPhone,
            });
          }
        }
      }

      // 3. Format username or peer if not resolved by phone
      if (!resolvedPeer) {
        if (typeof target === 'string') {
          target = target.trim();
          target = target.replace(/^(https?:\/\/)?(t\.me\/)/i, '');
          if (!target.startsWith('@') && !target.startsWith('-') && !target.startsWith('+') && isNaN(Number(target))) {
            target = `@${target}`;
          } else if (!isNaN(Number(target))) {
            target = Number(target);
          }
        }
        resolvedPeer = target;
      }

      console.log(`[GATEWAY] Final resolvedPeer to send to:`, typeof resolvedPeer === 'object' ? `User(${resolvedPeer.id})` : resolvedPeer);

      try {
        let result;
        if (body.mediaPath && fs.existsSync(body.mediaPath)) {
          console.log(`[GATEWAY] 📎 Sending media ${body.mediaPath} (isVoice: ${!!body.isVoice}) to peer...`);
          const caption = text && !text.startsWith('🎤 Голосовое') && !text.startsWith('📷 Фото') && !text.startsWith('📄 ') && !text.startsWith('🎥 Видео') ? text : '';
          const sendOptions = {
            file: body.mediaPath,
            caption: caption,
            voiceNote: !!body.isVoice,
          };

          if (body.isVoice) {
            sendOptions.attributes = [
              new Api.DocumentAttributeAudio({
                voice: true,
                duration: body.duration ? parseInt(body.duration, 10) : 0,
              })
            ];
          }

          result = await withTimeout(
            client.sendFile(resolvedPeer, sendOptions),
            35000,
            'Отправка медиафайла в Telegram превысила лимит ожидания (35 сек).'
          );
        } else {
          result = await withTimeout(
            client.sendMessage(resolvedPeer, { message: text }),
            12000,
            'Отправка в Telegram превысила лимит ожидания (12 сек). Telegram-сервер не ответил.'
          );
        }

        let peerId = null;
        if (result.peerId) {
          peerId = (result.peerId.userId || result.peerId.chatId || result.peerId.channelId || '').toString();
        }

        console.log(`[GATEWAY] ✅ Message sent successfully in ${Date.now() - startTime}ms! msgId: ${result.id}, peerId: ${peerId}`);

        return sendJson(200, {
          success: true,
          messageId: result.id,
          date: result.date,
          peerId: peerId,
          username: resolvedUsername,
          phone: detectedPhone,
        });
      } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[GATEWAY] ❌ Send error after ${elapsed}ms:`, err.message);
        const errMsg = String(err?.message || '');

        if (
          errMsg.includes('AUTH_KEY_UNREGISTERED') ||
          errMsg.includes('SESSION_REVOKED') ||
          errMsg.includes('SESSION_EXPIRED') ||
          errMsg.includes('USER_DEACTIVATED') ||
          errMsg.includes('401')
        ) {
          handleSessionLost(`Send failed with auth error: ${errMsg}`).catch(() => {});
        }

        if (errMsg.includes('Could not find the input entity') || errMsg.includes('PeerUser')) {
          return sendJson(400, {
            error: isPhoneTarget
              ? `Номер ${detectedPhone} не зарегистрирован в Telegram (или скрыт настройками приватности). Пожалуйста, укажите публичный @username блогера.`
              : 'Пользователь не найден в вашей сессии Telegram. Для первого сообщения укажите публичный @username блогера (например, @nickname), либо собеседник должен первым написать вам в Telegram.'
          });
        }

        if (errMsg.includes('превысила лимит ожидания') || errMsg.includes('timed out') || errMsg.includes('TIMEOUT')) {
          return sendJson(504, {
            error: 'Шлюз Telegram не получил ответ от серверов Telegram (таймаут 12 сек). Возможно, рабочий аккаунт переподключается к сети. Попробуйте повторить отправку через несколько секунд.'
          });
        }

        if (errMsg.includes('FLOOD_WAIT_')) {
          const seconds = errMsg.match(/\d+/) ? errMsg.match(/\d+/)[0] : 'несколько';
          return sendJson(429, {
            error: `Telegram временно ограничил отправку сообщений (Flood Wait на ${seconds} сек). Пожалуйста, подождите перед следующей отправкой.`
          });
        }

        if (errMsg.includes('PEER_FLOOD')) {
          return sendJson(429, {
            error: 'Telegram временно заблокировал отправку новым контактам с этого аккаунта (ограничение спам-фильтра Telegram). Попробуйте написать позже или дождитесь ответа блогера.'
          });
        }

        if (errMsg.includes('USER_IS_BLOCKED')) {
          return sendJson(403, {
            error: 'Этот пользователь заблокировал ваш рабочий Telegram-аккаунт.'
          });
        }

        return sendJson(500, { error: err.message || 'Failed to send message via Telegram' });
      } finally {
        if (body.mediaPath && fs.existsSync(body.mediaPath)) {
          try {
            fs.unlinkSync(body.mediaPath);
            console.log(`[GATEWAY] 🧹 Deleted temporary media file to preserve disk space: ${body.mediaPath}`);
          } catch (e) {}
        }
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

      // If a valid public username is provided, prioritize it
      if (body.username && typeof body.username === 'string') {
        const u = body.username.trim();
        if (/[a-zA-Z]/.test(u) && !u.startsWith('+')) {
          target = u.startsWith('@') ? u : `@${u}`;
        }
      }

      if (!target) {
        return sendJson(400, { error: 'Target is required' });
      }

      let resolvedPeer = null;
      const detectedPhone = extractPhoneNumber(target);
      if (detectedPhone) {
        const phoneResult = await resolvePhoneUser(detectedPhone);
        if (phoneResult.found && phoneResult.user) {
          resolvedPeer = phoneResult.user;
        } else {
          return sendJson(200, { success: true, messages: [], notFound: true, phone: detectedPhone });
        }
      }

      if (!resolvedPeer) {
        if (typeof target === 'string') {
          target = target.trim();
          target = target.replace(/^(https?:\/\/)?(t\.me\/)/i, '');
          if (!target.startsWith('@') && !target.startsWith('-') && !target.startsWith('+') && isNaN(Number(target))) {
            target = `@${target}`;
          } else if (!isNaN(Number(target))) {
            target = Number(target);
          }
        }
        resolvedPeer = target;
      }

      try {
        let readOutboxMaxId = 0;
        try {
          const inputPeer = await client.getInputEntity(resolvedPeer);
          const peerDialogs = await withTimeout(
            client.invoke(new Api.messages.GetPeerDialogs({ peers: [new Api.InputDialogPeer({ peer: inputPeer })] })),
            2500,
            'GetPeerDialogs timed out'
          );
          if (peerDialogs && peerDialogs.dialogs && peerDialogs.dialogs.length > 0) {
            readOutboxMaxId = peerDialogs.dialogs[0].readOutboxMaxId || 0;
          }
        } catch (e) {
          try {
            const dialogs = await withTimeout(client.getDialogs({ limit: 30 }), 2000, 'getDialogs timed out');
            const peerStr = String(resolvedPeer?.id || resolvedPeer).replace(/\D/g, '');
            const d = dialogs.find(d => String(d.id || '').replace(/\D/g, '') === peerStr);
            if (d?.dialog?.readOutboxMaxId) {
              readOutboxMaxId = d.dialog.readOutboxMaxId;
            }
          } catch (e2) {}
        }

        const messages = await withTimeout(
          client.getMessages(resolvedPeer, { limit: 25 }),
          8000,
          'History request timed out'
        );
        const list = [];
        for (const m of messages) {
          if (!m || !m.id) continue;
          let mSender = null;
          try { mSender = await m.getSender(); } catch (e) {}
          let mChat = null;
          try { mChat = await m.getChat(); } catch (e) {}

          let mType = null;
          let mUrl = null;
          let mDur = null;
          let mFile = null;

          if (m.media) {
            try {
              const mInfo = extractMediaMetadata(m);
              mType = mInfo.mediaType;
              mDur = mInfo.mediaDuration;
              mFile = mInfo.mediaFilename;
            } catch (e) {}
          }

          let mText = m.message || m.text || '';
          if (!mText && mType) {
            if (mType === 'voice') {
              mText = `🎤 Голосовое сообщение${mDur ? ` (${Math.floor(mDur / 60)}:${String(mDur % 60).padStart(2, '0')})` : ''}`;
            } else if (mType === 'photo') {
              mText = '📷 Фотография';
            } else if (mType === 'video') {
              mText = '🎥 Видеозапись';
            } else if (mType === 'audio') {
              mText = '🎵 Аудиофайл';
            } else {
              mText = `📄 ${mFile || 'Документ'}`;
            }
          }

          const isRead = !!(m.out && readOutboxMaxId && m.id <= readOutboxMaxId);

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
            text: mText,
            mediaUrl: mUrl,
            mediaType: mType,
            isRead: isRead,
            date: m.date,
          });
        }
        return sendJson(200, { success: true, messages: list });
      } catch (err) {
        console.error('Fetch history error:', err.message);
        const errMsg = String(err?.message || '');
        if (errMsg.includes('Could not find the input entity') || errMsg.includes('PeerUser')) {
          return sendJson(200, { success: true, messages: [] });
        }
        return sendJson(500, { error: err.message });
      }
    }

    // 6.1 POST /resolve - Resolve and check phone number or @username
    if (url.pathname === '/resolve' && req.method === 'POST') {
      if (!isAuthorized) {
        return sendJson(401, { error: 'Telegram gateway is not authorized.' });
      }
      const body = await readBody(5000);
      const target = body.target || body.to || body.username || body.phone;
      if (!target) {
        return sendJson(400, { error: 'Target is required' });
      }

      const phone = extractPhoneNumber(target);
      if (phone) {
        const res = await resolvePhoneUser(phone, body.name || 'Blogger');
        if (res.found) {
          return sendJson(200, {
            found: true,
            type: 'phone',
            phone: res.phone,
            peerId: res.id,
            username: res.username,
            firstName: res.firstName,
          });
        } else {
          return sendJson(404, {
            found: false,
            type: 'phone',
            phone: phone,
            error: `Номер ${phone} не зарегистрирован в Telegram (или пользователь скрыл аккаунт в настройках приватности).`,
          });
        }
      }

      try {
        let cleanUser = String(target).trim().replace(/^(https?:\/\/)?(t\.me\/)/i, '');
        if (!cleanUser.startsWith('@')) cleanUser = `@${cleanUser}`;
        const entity = await withTimeout(
          client.getEntity(cleanUser),
          6000,
          'Entity resolution timed out'
        );
        if (entity) {
          return sendJson(200, {
            found: true,
            type: 'username',
            peerId: entity.id ? entity.id.toString() : null,
            username: entity.username || null,
            firstName: entity.firstName || entity.title || '',
          });
        }
      } catch (e) {
        return sendJson(404, {
          found: false,
          type: 'username',
          error: `Пользователь ${target} не найден в Telegram.`,
        });
      }
    }

    // 7. POST /edit - Edit message in Telegram MTProto
    if (url.pathname === '/edit' && req.method === 'POST') {
      if (!isAuthorized) {
        return sendJson(401, { error: 'Telegram gateway is not authorized.' });
      }

      const body = await readBody(5000);
      let rawTarget = body.target || body.username || body.chatId || body.to;
      const messageId = parseInt(body.messageId, 10);
      const text = body.text;

      if (!rawTarget || !messageId || !text) {
        return sendJson(400, { error: 'Target, messageId, and text are required' });
      }

      let target = rawTarget;
      if (typeof target === 'string') {
        target = target.trim().replace(/^(https?:\/\/)?(t\.me\/)/i, '');
        if (!target.startsWith('@') && !target.startsWith('-') && !target.startsWith('+') && isNaN(Number(target))) {
          target = `@${target}`;
        } else if (!isNaN(Number(target))) {
          target = Number(target);
        }
      }

      try {
        const result = await withTimeout(
          client.editMessage(target, {
            message: messageId,
            text: text,
          }),
          10000,
          'Edit message timed out'
        );

        // Update in-memory updates queue if present
        const cached = recentUpdates.find(u => u.messageId === messageId);
        if (cached) cached.text = text;

        return sendJson(200, {
          success: true,
          messageId: result?.id || messageId,
          text: text,
        });
      } catch (err) {
        console.error('Edit message error:', err.message);
        const errMsg = String(err?.message || '');
        if (
          errMsg.includes('AUTH_KEY_UNREGISTERED') ||
          errMsg.includes('SESSION_REVOKED') ||
          errMsg.includes('SESSION_EXPIRED') ||
          errMsg.includes('USER_DEACTIVATED') ||
          errMsg.includes('401')
        ) {
          handleSessionLost(`Edit failed with auth error: ${errMsg}`).catch(() => {});
        }
        return sendJson(500, { error: err.message || 'Failed to edit message in Telegram' });
      }
    }

    // 8. POST /delete - Delete message in Telegram MTProto (revoke: true for everyone, false for me)
    if (url.pathname === '/delete' && req.method === 'POST') {
      if (!isAuthorized) {
        return sendJson(401, { error: 'Telegram gateway is not authorized.' });
      }

      const body = await readBody(5000);
      let rawTarget = body.target || body.username || body.chatId || body.to;
      const messageId = parseInt(body.messageId, 10);
      const revoke = body.revoke === true || body.revoke === 'true' || body.revoke === 1 || body.revoke === '1';

      if (!messageId) {
        return sendJson(400, { error: 'messageId is required' });
      }

      let target = rawTarget;
      if (typeof target === 'string') {
        target = target.trim().replace(/^(https?:\/\/)?(t\.me\/)/i, '');
        if (!target.startsWith('@') && !target.startsWith('-') && !target.startsWith('+') && isNaN(Number(target))) {
          target = `@${target}`;
        } else if (!isNaN(Number(target))) {
          target = Number(target);
        }
      }

      try {
        await withTimeout(
          client.deleteMessages(target, [messageId], { revoke: revoke }),
          10000,
          'Delete messages timed out'
        );

        // Remove from in-memory updates queue if present
        recentUpdates = recentUpdates.filter(u => u.messageId !== messageId);

        return sendJson(200, {
          success: true,
          messageId: messageId,
          revoke: revoke,
        });
      } catch (err) {
        console.error('Delete message error:', err.message);
        const errMsg = String(err?.message || '');
        if (
          errMsg.includes('AUTH_KEY_UNREGISTERED') ||
          errMsg.includes('SESSION_REVOKED') ||
          errMsg.includes('SESSION_EXPIRED') ||
          errMsg.includes('USER_DEACTIVATED') ||
          errMsg.includes('401')
        ) {
          handleSessionLost(`Delete failed with auth error: ${errMsg}`).catch(() => {});
        }
        return sendJson(500, { error: err.message || 'Failed to delete message in Telegram' });
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
