import { createHash, randomUUID as makeUUID } from 'node:crypto';

export class LeadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'LeadError';
    this.status = status;
  }
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const MAX_BOOKING_DAYS = 90;

export function telegramBotName(value) {
  const name = String(value ?? '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{5,32}$/.test(name) ? name : '';
}

export function parseJsonValue(value) {
  if (Buffer.isBuffer(value)) {
    try { return JSON.parse(value.toString('utf8')); } catch { throw new LeadError('Некорректный запрос.'); }
  }
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { throw new LeadError('Некорректный запрос.'); }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  throw new LeadError('Некорректный запрос.');
}

function normalizePhone(value) {
  let digits = text(value, 40).replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  const phone = digits ? `+${digits}` : '';
  return /^\+\d{10,15}$/.test(phone) ? phone : '';
}

function normalizeTime(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return '';
  const hour = Number(match[1]);
  if (hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return '';
  return value;
}

function yakutskDay(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yakutsk' }).format(new Date(ms));
}

function normalize(input, now) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new LeadError('Проверьте данные формы.');
  if (text(input.website, 200)) return null;

  const name = text(input.name, 80);
  const car = text(input.car, 120);
  const problem = text(input.problem, 700);
  const desired_date = calendarDate(text(input.desired_date, 10));
  const desired_time = normalizeTime(input.desired_time);
  const phone = normalizePhone(input.phone);

  if (!name || !car || !problem || !phone) throw new LeadError('Заполните имя, телефон, автомобиль и описание работ.');
  if (!desired_date || !desired_time) throw new LeadError('Укажите корректные дату и время.');

  const visitAt = new Date(`${desired_date}T${desired_time}:00+09:00`);
  if (Number.isNaN(visitAt.getTime()) || visitAt.getTime() <= now()) throw new LeadError('Выберите будущее время визита.');

  const today = yakutskDay(now());
  const [year, month, day] = today.split('-').map(Number);
  const limit = new Date(Date.UTC(year, month - 1, day + MAX_BOOKING_DAYS));
  const [limitYear, limitMonth, limitDay] = [limit.getUTCFullYear(), limit.getUTCMonth() + 1, limit.getUTCDate()];
  const maxDate = `${limitYear}-${String(limitMonth).padStart(2, '0')}-${String(limitDay).padStart(2, '0')}`;
  if (desired_date > maxDate) throw new LeadError('Выберите дату в ближайшие 90 дней.');

  return { name, phone, car, problem, desired_date, desired_time, source: 'website' };
}

function prune(map, timestamp, maxAge) {
  for (const [key, value] of map) {
    const last = Array.isArray(value) ? value.at(-1) ?? 0 : value;
    if (timestamp - last >= maxAge) map.delete(key);
  }
}

export function createLeadGateway({ webhookUrl, token, botUsername, fetchImpl = fetch, now = Date.now, randomUUID = makeUUID }) {
  const recent = new Map();
  const requests = new Map();

  return {
    async submit(input, ip = 'unknown') {
      const lead = normalize(input, now);
      if (!lead) return { ok: true };
      const bot = telegramBotName(botUsername);
      if (!webhookUrl || !token || !bot) throw new LeadError('Форма ещё не подключена. Напишите нам в Telegram.', 503);

      const timestamp = now();
      prune(requests, timestamp, 600_000);
      prune(recent, timestamp, 120_000);
      const hits = (requests.get(ip) ?? []).filter((time) => timestamp - time < 600_000);
      if (hits.length >= 5) throw new LeadError('Слишком много попыток. Попробуйте через несколько минут.', 429);
      requests.set(ip, [...hits, timestamp]);

      const fingerprint = createHash('sha256').update(JSON.stringify(lead)).digest('hex');
      if (timestamp - (recent.get(fingerprint) ?? 0) < 120_000) throw new LeadError('Эта заявка уже отправлена.', 409);

      const requestId = randomUUID();
      let response;
      try {
        response = await fetchImpl(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-vektor-token': token },
          body: JSON.stringify({ request_id: requestId, ...lead }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new LeadError('Не удалось отправить заявку. Попробуйте Telegram.', 502);
      }
      if (!response.ok) throw new LeadError('Не удалось отправить заявку. Попробуйте Telegram.', 502);

      recent.set(fingerprint, timestamp);
      const start = `site_${requestId.replaceAll('-', '')}`;
      return { ok: true, requestId, telegramUrl: `https://t.me/${bot}?start=${start}` };
    },
  };
}
