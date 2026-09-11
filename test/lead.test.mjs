import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { createLeadGateway, LeadError, parseJsonValue, telegramBotName } from '../lib/lead.mjs';

const NOW = Date.parse('2026-09-12T12:00:00+09:00');
const validLead = {
  name: 'Анна',
  phone: '+7 999 000-00-00',
  car: 'Toyota Corolla 2018',
  problem: 'Нужна диагностика ходовой',
  desired_date: '2026-10-15',
  desired_time: '14:30',
  consent: true,
  website: '',
};

const gatewayOf = (overrides = {}) => createLeadGateway({
  webhookUrl: 'http://127.0.0.1:1',
  token: 'demo',
  botUsername: 'VektorBot',
  now: () => NOW,
  ...overrides,
});

let received;
let webhook;

before(async () => {
  webhook = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      received = { headers: req.headers, body: JSON.parse(body) };
      res.writeHead(202).end();
    });
  });
  await new Promise((resolve) => webhook.listen(0, '127.0.0.1', resolve));
});

after(() => webhook.close());

test('rejects an incomplete lead before sending it', async () => {
  await assert.rejects(() => gatewayOf().submit({ ...validLead, phone: '123' }, '127.0.0.1'), (error) => {
    assert.equal(error instanceof LeadError, true);
    assert.equal(error.status, 400);
    return true;
  });
});

test('rejects impossible calendar dates', async () => {
  await assert.rejects(() => gatewayOf().submit({ ...validLead, desired_date: '2026-02-31' }, '127.0.0.8'), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
});

test('rejects dates farther than 90 days', async () => {
  await assert.rejects(() => gatewayOf().submit({ ...validLead, desired_date: '2099-10-15' }, '127.0.0.11'), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
});

test('silently drops honeypot submissions', async () => {
  received = undefined;
  const result = await gatewayOf().submit({ ...validLead, website: 'spam.example' }, '127.0.0.2');
  assert.deepEqual(result, { ok: true });
  assert.equal(received, undefined);
});

test('requires server-side n8n configuration', async () => {
  await assert.rejects(() => gatewayOf({ webhookUrl: '', token: '' }).submit(validLead, '127.0.0.3'), (error) => {
    assert.equal(error.status, 503);
    return true;
  });
});

test('rejects an unsafe telegram bot username', async () => {
  await assert.rejects(() => gatewayOf({ botUsername: 'https://evil.example' }).submit(validLead, '127.0.0.9'), (error) => {
    assert.equal(error.status, 503);
    return true;
  });
});

test('accepts a valid lead without a demo consent field', async () => {
  const port = webhook.address().port;
  const gateway = gatewayOf({
    webhookUrl: `http://127.0.0.1:${port}/lead`,
    randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
  });
  const { consent, ...leadWithoutConsent } = validLead;

  const result = await gateway.submit(leadWithoutConsent, '127.0.0.6');

  assert.equal(result.ok, true);
  assert.equal(received.body.request_id, '123e4567-e89b-12d3-a456-426614174000');
});

test('relays a normalized lead and returns an opaque Telegram link', async () => {
  received = undefined;
  const port = webhook.address().port;
  const gateway = gatewayOf({
    webhookUrl: `http://127.0.0.1:${port}/lead`,
    token: 'server-only-token',
    botUsername: '@VektorBot',
    randomUUID: () => '11111111-2222-4333-8444-555555555555',
  });

  const result = await gateway.submit(validLead, '127.0.0.4');

  assert.deepEqual(result, {
    ok: true,
    requestId: '11111111-2222-4333-8444-555555555555',
    telegramUrl: 'https://t.me/VektorBot?start=site_11111111222243338444555555555555',
  });
  assert.equal(received.headers['x-vektor-token'], 'server-only-token');
  assert.deepEqual(received.body, {
    request_id: '11111111-2222-4333-8444-555555555555',
    name: 'Анна',
    phone: '+79990000000',
    car: 'Toyota Corolla 2018',
    problem: 'Нужна диагностика ходовой',
    desired_date: '2026-10-15',
    desired_time: '14:30',
    source: 'website',
  });
});

test('normalizes a 10-digit Russian number and time with seconds', async () => {
  received = undefined;
  const port = webhook.address().port;
  const gateway = gatewayOf({
    webhookUrl: `http://127.0.0.1:${port}/lead`,
    randomUUID: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  });

  const result = await gateway.submit({ ...validLead, phone: '9990000000', desired_time: '14:30:00' }, '127.0.0.10');

  assert.equal(result.ok, true);
  assert.equal(received.body.phone, '+79990000000');
  assert.equal(received.body.desired_time, '14:30');
});

test('blocks the same lead from being sent twice', async () => {
  const port = webhook.address().port;
  const gateway = gatewayOf({ webhookUrl: `http://127.0.0.1:${port}/lead` });
  await gateway.submit(validLead, '127.0.0.5');
  await assert.rejects(() => gateway.submit(validLead, '127.0.0.5'), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
});

test('parses JSON objects and rejects invalid payloads', () => {
  assert.deepEqual(parseJsonValue('{"name":"Анна"}'), { name: 'Анна' });
  assert.equal(telegramBotName('@VektorAutoDemoBot'), 'VektorAutoDemoBot');
  assert.equal(telegramBotName('https://t.me/VektorAutoDemoBot'), '');
  assert.throws(() => parseJsonValue('not-json'), (error) => error instanceof LeadError);
});
