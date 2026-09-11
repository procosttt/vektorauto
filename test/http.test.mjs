import assert from 'node:assert/strict';
import test from 'node:test';
import { clientIp, contentType, isPublicPath } from '../lib/http.mjs';

test('serves HTML as a web page instead of a download', () => {
  assert.equal(contentType('index.html'), 'text/html; charset=utf-8');
});

test('exposes only the public website files', () => {
  assert.equal(isPublicPath('/'), true);
  assert.equal(isPublicPath('/index.html'), true);
  assert.equal(isPublicPath('/styles.css'), true);
  assert.equal(isPublicPath('/assets/hero-car.png'), true);
  assert.equal(isPublicPath('/.env'), false);
  assert.equal(isPublicPath('/lib/lead.mjs'), false);
  assert.equal(isPublicPath('/assets/../.env'), false);
  assert.equal(isPublicPath('/server.mjs'), false);
});

test('reads the leftmost forwarded client address', () => {
  assert.equal(clientIp({ 'x-real-ip': '203.0.113.10' }), '203.0.113.10');
  assert.equal(clientIp({ 'x-forwarded-for': '203.0.113.8, 10.0.0.1' }), '203.0.113.8');
});
