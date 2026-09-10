export default function handler(_req, res) {
  const bot = String(process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '');
  if (!bot) return res.status(503).send('Telegram ещё не подключён.');
  return res.redirect(302, `https://t.me/${bot}`);
}
