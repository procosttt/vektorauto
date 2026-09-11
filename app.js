import { buildDateChoices } from './booking.js';

const form = document.querySelector('#lead-form');
const status = document.querySelector('#form-status');
const submit = form.querySelector('button[type="submit"]');
const success = document.querySelector('#success-panel');
const telegram = document.querySelector('#success-telegram');
const dateInput = form.elements.desired_date;
const timeInput = form.elements.desired_time;
const dateChoices = document.querySelector('#date-choices');

function selectChoice(button, input) {
  button.parentElement.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  input.value = button.dataset.value;
}

buildDateChoices().forEach(({ value, weekday, label }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.choice = 'date';
  button.dataset.value = value;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `${weekday}, ${label}`);
  button.innerHTML = `<span>${weekday}</span><b>${label}</b>`;
  dateChoices.append(button);
});

form.querySelectorAll('[data-choice="date"]').forEach((button) => button.addEventListener('click', () => selectChoice(button, dateInput)));
form.querySelectorAll('[data-choice="time"]').forEach((button) => button.addEventListener('click', () => selectChoice(button, timeInput)));

document.querySelector('#fill-demo').addEventListener('click', () => {
  Object.assign(form.elements.name, { value: 'Алексей' });
  Object.assign(form.elements.phone, { value: '+7 999 000-00-00' });
  Object.assign(form.elements.car, { value: 'Toyota Corolla 2018' });
  Object.assign(form.elements.problem, { value: 'Нужна диагностика ходовой, появился стук спереди' });
  selectChoice(dateChoices.querySelectorAll('button')[1], dateInput);
  selectChoice(form.querySelector('[data-choice="time"][data-value="15:00"]'), timeInput);
  status.textContent = 'Демо-данные заполнены. Можно отправлять.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.className = 'form-status';
  if (!form.reportValidity()) return;
  if (!dateInput.value || !timeInput.value) {
    status.className = 'form-status form-status-error';
    status.textContent = 'Выберите желаемые дату и время.';
    document.querySelector(!dateInput.value ? '#date-field button' : '#time-field button').focus();
    return;
  }

  submit.disabled = true;
  submit.querySelector('span').textContent = 'Отправляем…';
  status.textContent = 'Передаём заявку администратору.';

  const data = Object.fromEntries(new FormData(form));

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
