import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { createLeadGateway, LeadError, parseJsonValue, telegramBotName } from './lib/lead.mjs';
import { clientIp, contentType, isPublicPath } from './lib/http.mjs';

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

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), { 'content-type': 'application/json; charset=utf-8' });
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new LeadError('Слишком большой запрос.', 413);
    chunks.push(buffer);
  }
  return parseJsonValue(Buffer.concat(chunks));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/lead') {
      return json(res, 200, await gateway.submit(await body(req), clientIp(req.headers, req.socket.remoteAddress)));
    }
    if (req.method === 'GET' && url.pathname === '/telegram') {
      const bot = telegramBotName(process.env.TELEGRAM_BOT_USERNAME);
      if (!bot) {
        return send(res, 503, '<!doctype html><meta charset="utf-8"><title>Telegram</title><p>Telegram ещё не подключён.</p><p><a href="/">На главную</a></p>', { 'content-type': 'text/html; charset=utf-8' });
      }
      res.writeHead(302, { location: `https://t.me/${bot}`, 'cache-control': 'no-store' });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false, message: 'Метод не поддерживается.' });

    let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    try { pathname = decodeURIComponent(pathname); } catch { return json(res, 400, { ok: false, message: 'Некорректный запрос.' }); }
    if (!isPublicPath(pathname)) return json(res, 404, { ok: false, message: 'Не найдено.' });

    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${sep}`)) return json(res, 404, { ok: false, message: 'Не найдено.' });
    const content = await readFile(file);
    const type = contentType(file);
    const cache = type.startsWith('image/') ? 'public, max-age=86400' : 'no-store';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff' });
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
