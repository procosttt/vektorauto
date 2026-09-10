import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { createLeadGateway, LeadError } from '../lib/lead.mjs';

const validLead = {
  name: 'Анна',
  phone: '+7 999 000-00-00',
  car: 'Toyota Corolla 2018',
  problem: 'Нужна диагностика ходовой',
  desired_date: '2099-10-15',
  desired_time: '14:30',
  consent: true,
  website: '',
};

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
  const gateway = createLeadGateway({ webhookUrl: 'http://127.0.0.1:1', token: 'demo', botUsername: 'VektorBot' });
  await assert.rejects(() => gateway.submit({ ...validLead, phone: '123' }, '127.0.0.1'), (error) => {
    assert.equal(error instanceof LeadError, true);
    assert.equal(error.status, 400);
    return true;
  });
});

test('silently drops honeypot submissions', async () => {
  received = undefined;
  const gateway = createLeadGateway({ webhookUrl: 'http://127.0.0.1:1', token: 'demo', botUsername: 'VektorBot' });
  const result = await gateway.submit({ ...validLead, website: 'spam.example' }, '127.0.0.2');
  assert.deepEqual(result, { ok: true });
  assert.equal(received, undefined);
});

test('requires server-side n8n configuration', async () => {
  const gateway = createLeadGateway({ webhookUrl: '', token: '', botUsername: 'VektorBot' });
  await assert.rejects(() => gateway.submit(validLead, '127.0.0.3'), (error) => {
    assert.equal(error.status, 503);
    return true;
  });
});

test('relays a normalized lead and returns an opaque Telegram link', async () => {
  received = undefined;
  const port = webhook.address().port;
  const gateway = createLeadGateway({
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
    desired_date: '2099-10-15',
    desired_time: '14:30',
    source: 'website',
  });
});

test('blocks the same lead from being sent twice', async () => {
  const port = webhook.address().port;
  const gateway = createLeadGateway({ webhookUrl: `http://127.0.0.1:${port}/lead`, token: 'demo', botUsername: 'VektorBot' });
  await gateway.submit(validLead, '127.0.0.5');
  await assert.rejects(() => gateway.submit(validLead, '127.0.0.5'), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
});
