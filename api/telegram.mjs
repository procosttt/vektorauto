import { telegramBotName } from '../lib/lead.mjs';

export default function handler(_req, res) {
  res.setHeader('cache-control', 'no-store');
  const bot = telegramBotName(process.env.TELEGRAM_BOT_USERNAME);
  if (!bot) return res.status(503).send('Telegram ещё не подключён.');
  return res.redirect(302, `https://t.me/${bot}`);
}
