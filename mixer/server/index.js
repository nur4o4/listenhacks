import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_SOURCE_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const FRONTEND_ASSETS = ['index.html', 'css', 'js'];
const MAX_ACTIONS = 200;

const ACTION_ALLOWLIST = new Set([
  'ENABLE_MIC',
  'START_RECORD',
  'END_RECORD',
  'PLAY',
  'PAUSE',
  'START_LOOP',
  'END_LOOP',
  'SET_REVERB_ENABLED',
  'SET_REVERB_DECAY',
  'SET_DELAY_ENABLED',
  'SET_DELAY_TIME',
  'SET_DELAY_FEEDBACK',
  'SET_DELAY_WET',
  'SET_DELAY_ADVANCED_CLAMP',
  'SET_AUTOTUNE_ENABLED',
  'SET_AUTOTUNE_SEMITONES',
  'TOGGLE_MONITORING',
]);

const recentActions = [];
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

async function exists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

function sanitizeActionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return payload;
}

function pushRecentAction(action) {
  recentActions.push(action);
  while (recentActions.length > MAX_ACTIONS) {
    recentActions.shift();
  }
}

function broadcastAction(action) {
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(action));
      count += 1;
    }
  }

  console.log(
    `[ws] action broadcast ${action.type}`,
    `id=${action.id}`,
    `clients=${count}`,
  );
}

async function preparePublicDirectory() {
  await fs.promises.mkdir(PUBLIC_DIR, { recursive: true });

  for (const entry of FRONTEND_ASSETS) {
    const source = path.join(FRONTEND_SOURCE_DIR, entry);
    const target = path.join(PUBLIC_DIR, entry);

    if (!(await exists(source))) {
      continue;
    }

    await fs.promises.rm(target, { recursive: true, force: true });
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.cp(source, target, { recursive: true });
  }
}

function allowlistActionType(type) {
  return ACTION_ALLOWLIST.has(type);
}

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

wss.on('connection', (socket) => {
  console.log('[ws] client connected');

  socket.on('close', () => {
    console.log('[ws] client disconnected');
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/actions/recent', (req, res) => {
  res.json(recentActions);
});

app.post('/api/actions', (req, res) => {
  const body = req.body || {};
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const clientId = body.clientId;
  const payload = sanitizeActionPayload(body.payload);

  if (!type) {
    return res.status(400).json({
      ok: false,
      error: 'type is required',
    });
  }

  if (!allowlistActionType(type)) {
    return res.status(400).json({
      ok: false,
      error: 'Unknown action type',
      type,
    });
  }

  const action = {
    id: clientId || randomUUID(),
    type,
    payload,
    clientId,
    receivedAtMs: Date.now(),
  };

  pushRecentAction(action);
  console.log('[http] action received', action.type, action.id);

  broadcastAction(action);
  return res.json({
    ok: true,
    id: action.id,
  });
});

const fallback = (req, res) => {
  if (req.method !== 'GET') {
    return;
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (error) => {
    if (error) {
      res.status(404).send('Frontend not found');
    }
  });
};

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }

  if (req.method !== 'GET') {
    return next();
  }

  return fallback(req, res);
});

preparePublicDirectory()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
      console.log('[server] action allowlist:', Array.from(ACTION_ALLOWLIST).join(', '));
    });
  })
  .catch((error) => {
    console.error('Failed to prepare frontend public directory', error);
    process.exit(1);
  });
