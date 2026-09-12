import { easeScroll, scrollDuration } from './motion.js';

const form = document.querySelector('#lead-form');
const status = document.querySelector('#form-status');
const submit = form.querySelector('button[type="submit"]');
const success = document.querySelector('#success-panel');
const telegram = document.querySelector('#success-telegram');
const dateInput = form.elements.desired_date;
const timeInput = form.elements.desired_time;
const timeButtons = [...form.querySelectorAll('[data-time]')];

const localDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const shiftDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
const refreshDateBounds = () => {
  dateInput.min = localDate(shiftDays(1));
  dateInput.max = localDate(shiftDays(90));
};
refreshDateBounds();
dateInput.addEventListener('focus', refreshDateBounds);

const syncTimeButtons = () => timeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.time === timeInput.value)));
timeButtons.forEach((button) => button.addEventListener('click', () => {
  timeInput.value = button.dataset.time;
  syncTimeButtons();
}));
timeInput.addEventListener('input', syncTimeButtons);
timeInput.addEventListener('change', syncTimeButtons);

document.querySelector('#fill-demo').addEventListener('click', () => {
  refreshDateBounds();
  Object.assign(form.elements.name, { value: 'Алексей' });
  Object.assign(form.elements.phone, { value: '+7 999 000-00-00' });
  Object.assign(form.elements.car, { value: 'Toyota Corolla 2018' });
  Object.assign(form.elements.problem, { value: 'Нужна диагностика ходовой, появился стук спереди' });
  dateInput.value = localDate(shiftDays(1));
  timeInput.value = '15:00';
  syncTimeButtons();
  status.className = 'form-status';
  status.textContent = 'Демо-данные заполнены. Можно отправлять.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.className = 'form-status';
  if (!form.reportValidity()) return;
  if (!dateInput.value || !timeInput.value) {
    status.className = 'form-status form-status-error';
    status.textContent = 'Выберите желаемые дату и время.';
    (!dateInput.value ? dateInput : timeInput).focus();
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
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Не удалось отправить заявку.');
    telegram.href = result.telegramUrl || '/telegram';
    form.hidden = true;
    document.querySelector('.form-meta').hidden = true;
    success.hidden = false;
    success.focus();
  } catch (error) {
    const message = String(error?.message || '');
    status.className = 'form-status form-status-error';
    status.textContent = !message || /json|fetch|network|failed|unexpected/i.test(message)
      ? 'Не удалось отправить заявку. Попробуйте ещё раз.'
      : message;
    submit.disabled = false;
    submit.querySelector('span').textContent = 'Повторить отправку';
  }
});

let activeScroll;

function scrollToAnchor(target, hash) {
  activeScroll?.abort();
  history.pushState(null, '', hash);
  const top = Math.max(0, Math.min(scrollY + target.getBoundingClientRect().top, document.documentElement.scrollHeight - innerHeight));
  const distance = top - scrollY;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(distance) < 2) {
    scrollTo(0, top);
    return;
  }

  const controller = new AbortController();
  activeScroll = controller;
  const start = scrollY;
  const duration = scrollDuration(distance);
  const started = performance.now();
  const cancel = () => controller.abort();
  addEventListener('wheel', cancel, { passive: true, once: true, signal: controller.signal });
  addEventListener('touchstart', cancel, { passive: true, once: true, signal: controller.signal });
  addEventListener('pointerdown', cancel, { passive: true, once: true, signal: controller.signal });
  addEventListener('keydown', cancel, { once: true, signal: controller.signal });

  const frame = (now) => {
    if (controller.signal.aborted) return;
    const progress = Math.min(1, (now - started) / duration);
    scrollTo(0, start + distance * easeScroll(progress));
    if (progress < 1) return requestAnimationFrame(frame);
    controller.abort();
    activeScroll = undefined;
  };
  requestAnimationFrame(frame);
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#"]');
  const hash = link?.getAttribute('href');
  const target = hash?.length > 1 ? document.getElementById(hash.slice(1)) : null;
  if (!target) return;
  event.preventDefault();
  scrollToAnchor(target, hash);
});
