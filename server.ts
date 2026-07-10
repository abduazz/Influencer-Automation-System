import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'allowed-users.json');
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const SEED_USERS = [
  {
    id: 'user-1',
    email: 'abduazizmurodqosimov@gmail.com',
    role: 'super_admin',
    createdAt: '2026-07-10',
  },
  {
    id: 'user-2',
    email: 'pr@fluenceflow.com',
    role: 'pr_manager',
    createdAt: '2026-07-10',
  },
  {
    id: 'user-3',
    email: 'product@fluenceflow.com',
    role: 'product_manager',
    createdAt: '2026-07-10',
  },
];

type AllowedUser = {
  id: string;
  email: string;
  role: 'super_admin' | 'pr_manager' | 'product_manager';
  createdAt: string;
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_USERS, null, 2));
  }
}

function readUsers(): AllowedUser[] {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as AllowedUser[];
}

function writeUsers(users: AllowedUser[]) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

async function start() {
  const app = express();
  app.use(express.json());

  app.get('/api/allowed-users', (_req, res) => {
    try {
      res.json(readUsers());
    } catch {
      res.status(500).json({ error: 'Failed to read allowed users' });
    }
  });

  app.post('/api/allowed-users', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role;

    if (!email || !['super_admin', 'pr_manager', 'product_manager'].includes(role)) {
      res.status(400).json({ error: 'Invalid email or role' });
      return;
    }

    const users = readUsers();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    const newUser: AllowedUser = {
      id: `user-${Date.now()}`,
      email,
      role,
      createdAt: new Date().toISOString().split('T')[0],
    };

    writeUsers([...users, newUser]);
    res.status(201).json(newUser);
  });

  app.delete('/api/allowed-users/:id', (req, res) => {
    const users = readUsers();
    const nextUsers = users.filter((u) => u.id !== req.params.id);

    if (nextUsers.length === users.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    writeUsers(nextUsers);
    res.status(204).end();
  });

  if (isProd) {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
