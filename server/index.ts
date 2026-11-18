import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { attachClient, heartbeat, roomStats } from './roomManager';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works both unbundled (server/index.ts) and bundled (server/dist/index.js).
const candidates = [path.resolve(here, '..'), path.resolve(here, '../..'), process.cwd()];
const root = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'dist', 'index.html'))) ?? process.cwd();
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT ?? 8787);

const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'draw-our-fish', uptime: process.uptime(), ...roomStats() });
});

app.get('/api/room-stats', (_req, res) => {
  res.json(roomStats());
});

app.use(
  express.static(dist, {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      if (/\.(js|css|woff2?|svg|png|webp)$/.test(filePath) && !filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(dist, 'index.html'), (error) => {
    if (error) {
      res
        .status(200)
        .type('text/plain')
        .send('Draw Our Fish server is running. Build the client with `npm run build`.');
    }
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 150_000 });

server.on('upgrade', (request, socket, head) => {
  let pathname = '/';
  try {
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  } catch {
    socket.destroy();
    return;
  }
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (socket) => {
  attachClient(socket);
});

const heartbeatTimer = setInterval(heartbeat, 30_000);
heartbeatTimer.unref?.();

server.listen(port, () => {
  console.log(`[draw-our-fish] listening on http://localhost:${port}`);
  console.log(`[draw-our-fish] websocket at ws://localhost:${port}/ws`);
});

function shutdown() {
  clearInterval(heartbeatTimer);
  for (const client of wss.clients) {
    try {
      client.close(1001, 'server shutting down');
    } catch {
      // ignore
    }
  }
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
