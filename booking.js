export const localDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

export function buildDateChoices(now = new Date(), count = 5) {
  const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index + 1);
    return {
      value: localDate(date),
      weekday: weekday.format(date).replace('.', ''),
      label: dayMonth.format(date).replace('.', ''),
    };
  });
}
