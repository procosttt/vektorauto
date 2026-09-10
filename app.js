const form = document.querySelector('#lead-form');
const status = document.querySelector('#form-status');
const submit = form.querySelector('button[type="submit"]');
const success = document.querySelector('#success-panel');
const telegram = document.querySelector('#success-telegram');
const dateInput = form.elements.desired_date;

const localDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
dateInput.min = localDate(new Date());

document.querySelector('#fill-demo').addEventListener('click', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  Object.assign(form.elements.name, { value: 'Алексей' });
  Object.assign(form.elements.phone, { value: '+7 999 000-00-00' });
  Object.assign(form.elements.car, { value: 'Toyota Corolla 2018' });
  Object.assign(form.elements.problem, { value: 'Нужна диагностика ходовой, появился стук спереди' });
  Object.assign(form.elements.desired_date, { value: localDate(tomorrow) });
  Object.assign(form.elements.desired_time, { value: '14:30' });
  form.elements.consent.checked = true;
  status.textContent = 'Демо-данные заполнены. Можно отправлять.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.className = 'form-status';
  if (!form.reportValidity()) return;

  submit.disabled = true;
  submit.querySelector('span').textContent = 'Отправляем…';
  status.textContent = 'Передаём заявку администратору.';

  const data = Object.fromEntries(new FormData(form));
  data.consent = form.elements.consent.checked;

  try {
    const response = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Не удалось отправить заявку.');
    if (!result.telegramUrl) throw new Error('Заявка принята, но Telegram пока не подключён.');
    telegram.href = result.telegramUrl;
    form.hidden = true;
    document.querySelector('.form-meta').hidden = true;
    success.hidden = false;
    success.focus();
  } catch (error) {
    status.className = 'form-status form-status-error';
    status.textContent = error.message;
    submit.disabled = false;
    submit.querySelector('span').textContent = 'Повторить отправку';
  }
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((item) => observer.observe(item));
} else {
  document.querySelectorAll('.reveal').forEach((item) => item.classList.add('is-visible'));
}
