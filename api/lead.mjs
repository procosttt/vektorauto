import { createLeadGateway, LeadError } from '../lib/lead.mjs';

let gateway;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Метод не поддерживается.' });
  gateway ??= createLeadGateway({
    webhookUrl: process.env.N8N_WEBHOOK_URL,
    token: process.env.N8N_WEBHOOK_TOKEN,
    botUsername: process.env.TELEGRAM_BOT_USERNAME,
  });
  try {
    const ip = String(req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim();
    return res.status(200).json(await gateway.submit(req.body, ip));
  } catch (error) {
    const status = error instanceof LeadError ? error.status : 500;
    return res.status(status).json({ ok: false, message: status === 500 ? 'Не удалось отправить заявку.' : error.message });
  }
}
