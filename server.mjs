import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { createLeadGateway, LeadError } from './lib/lead.mjs';
import { contentType } from './lib/http.mjs';

async function loadEnv(file = '.env') {
  try {
    for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnv();

const root = process.cwd();
const gateway = createLeadGateway({
  webhookUrl: process.env.N8N_WEBHOOK_URL,
  token: process.env.N8N_WEBHOOK_TOKEN,
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
});

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 16_384) throw new LeadError('Слишком большой запрос.', 413);
  }
  try { return JSON.parse(raw); } catch { throw new LeadError('Некорректный запрос.'); }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/lead') {
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
      return json(res, 200, await gateway.submit(await body(req), ip));
    }
    if (req.method === 'GET' && url.pathname === '/telegram') {
      const bot = String(process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '');
      if (!bot) return json(res, 503, { ok: false, message: 'Telegram ещё не подключён.' });
      res.writeHead(302, { location: `https://t.me/${bot}` });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false, message: 'Метод не поддерживается.' });

    const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${sep}`)) return json(res, 404, { ok: false, message: 'Не найдено.' });
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': contentType(file) });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { ok: false, message: 'Не найдено.' });
    const status = error instanceof LeadError ? error.status : 500;
    json(res, status, { ok: false, message: status === 500 ? 'Внутренняя ошибка.' : error.message });
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '127.0.0.1', () => console.log(`Vektor Auto: http://localhost:${port}`));
