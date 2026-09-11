import { createLeadGateway, LeadError, parseJsonValue } from '../lib/lead.mjs';
import { clientIp } from '../lib/http.mjs';

let gateway;
let gatewayKey = '';

function getGateway() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL ?? '';
  const token = process.env.N8N_WEBHOOK_TOKEN ?? '';
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';
  const key = `${webhookUrl}\0${token}\0${botUsername}`;
  if (!gateway || key !== gatewayKey) {
    gateway = createLeadGateway({ webhookUrl, token, botUsername });
    gatewayKey = key;
  }
  return gateway;
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Метод не поддерживается.' });
  try {
    const ip = clientIp(req.headers);
    if (req.body == null) throw new LeadError('Некорректный запрос.');
    return res.status(200).json(await getGateway().submit(parseJsonValue(req.body), ip));
  } catch (error) {
    const status = error instanceof LeadError ? error.status : 500;
    return res.status(status).json({ ok: false, message: status === 500 ? 'Не удалось отправить заявку.' : error.message });
  }
}
