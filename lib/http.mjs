import { extname } from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const PUBLIC_FILES = new Set(['/', '/index.html', '/styles.css', '/app.js', '/motion.js']);
const PUBLIC_ASSET = /\.(?:png|webp|svg|jpe?g|ico|gif)$/i;

export const contentType = (file) => types[extname(file).toLowerCase()] ?? 'application/octet-stream';

export function isPublicPath(pathname) {
  if (PUBLIC_FILES.has(pathname)) return true;
  if (!pathname.startsWith('/assets/') || pathname.includes('..') || pathname.includes('\\')) return false;
  const rest = pathname.slice('/assets/'.length);
  return Boolean(rest) && !rest.endsWith('/') && PUBLIC_ASSET.test(pathname);
}

export function clientIp(headers, fallback = 'unknown') {
  const raw = String(headers['x-real-ip'] || headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || fallback);
  return raw.split(',')[0].trim() || fallback;
}
