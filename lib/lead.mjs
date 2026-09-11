import { createHash, randomUUID as makeUUID } from 'node:crypto';

export class LeadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'LeadError';
    this.status = status;
  }
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new LeadError('Проверьте данные формы.');
  if (text(input.website, 200)) return null;

  const name = text(input.name, 80);
  const car = text(input.car, 120);
  const problem = text(input.problem, 700);
  const desired_date = text(input.desired_date, 10);
  const desired_time = text(input.desired_time, 5);
  let digits = text(input.phone, 40).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  const phone = digits ? `+${digits}` : '';

  if (!name || !car || !problem || !/^\+\d{10,15}$/.test(phone)) throw new LeadError('Заполните имя, телефон, автомобиль и описание работ.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desired_date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(desired_time)) throw new LeadError('Укажите корректные дату и время.');
  if (new Date(`${desired_date}T${desired_time}:00+09:00`).getTime() <= Date.now()) throw new LeadError('Выберите будущее время визита.');
  return { name, phone, car, problem, desired_date, desired_time, source: 'website' };
}

export function createLeadGateway({ webhookUrl, token, botUsername, fetchImpl = fetch, now = Date.now, randomUUID = makeUUID }) {
  const recent = new Map();
  const requests = new Map();

  return {
    async submit(input, ip = 'unknown') {
      const lead = normalize(input);
      if (!lead) return { ok: true };
      if (!webhookUrl || !token || !botUsername) throw new LeadError('Форма ещё не подключена. Напишите нам в Telegram.', 503);

      const timestamp = now();
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
      const bot = botUsername.replace(/^@/, '');
      const start = `site_${requestId.replaceAll('-', '')}`;
      return { ok: true, requestId, telegramUrl: `https://t.me/${bot}?start=${start}` };
    },
  };
}
