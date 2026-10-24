import {
  DOCTORS, PETS, SERVICES, URGENT, filterServices, freeSlots, groupServices, normalizePhone, vaccinationPlan,
  validateBooking,
} from './logic.js';

const $ = (id) => document.getElementById(id);
const rub = (n) => `${n.toLocaleString('ru-RU')} ₽`;
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const human = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${d} ${MONTHS[m - 1]}, ${WEEKDAYS[date.getDay()]}`;
};

// ---------- Прайс ----------

let pet = 'all';
function renderChips() {
  $('petChips').replaceChildren(...Object.entries({ all: 'Все', ...PETS }).map(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(key === pet));
    b.addEventListener('click', () => {
      pet = key;
      renderChips();
      renderPrices();
    });
    return b;
  }));
}

function renderPrices() {
  const groups = groupServices(filterServices(SERVICES, pet, $('search').value));
  const box = $('priceList');
  if (!Object.keys(groups).length) {
    box.innerHTML = '<p class="empty">Такой услуги не нашлось. Позвоните нам: подскажем, чем можем помочь.</p>';
    return;
  }
  box.replaceChildren(...Object.entries(groups).map(([group, items]) => {
    const card = document.createElement('div');
    card.className = 'card price-group';
    const h = document.createElement('h3');
    h.textContent = group;
    const ul = document.createElement('ul');
    for (const s of items) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = s.name;
      const price = document.createElement('b');
      price.textContent = `от ${rub(s.price)}`;
      li.append(name, price);
      ul.append(li);
    }
    card.append(h, ul);
    return card;
  }));
}
$('search').addEventListener('input', renderPrices);

// ---------- Прививки ----------

const STATUS = { overdue: 'пора', now: 'на этой неделе', soon: 'скоро', later: 'запланировано' };

function renderVaccines() {
  const form = $('vaccForm');
  const list = $('timeline');
  if (!form.birth.value) {
    list.innerHTML = '<li><span class="date">Укажите дату рождения</span><small>График появится здесь</small></li>';
    return;
  }
  const [y, m, d] = form.birth.value.split('-').map(Number);
  let plan;
  try {
    plan = vaccinationPlan(form.kind.value, new Date(y, m - 1, d));
  } catch (e) {
    list.innerHTML = `<li><span class="date">${e.message}</span><small>Проверьте дату</small></li>`;
    return;
  }
  list.replaceChildren(...plan.map((step) => {
    const li = document.createElement('li');
    li.className = `st-${step.status}`;
    const when = step.days > 0 ? `через ${step.days} дн.` : step.days === 0 ? 'сегодня' : `${-step.days} дн. назад`;
    li.innerHTML = `<span class="date">${human(step.date)}<span class="badge">${STATUS[step.status]}</span></span>
      <strong>${step.title}</strong><small>${step.note}. ${when}</small>
      <small>От глистов: ${human(step.deworm)}</small>`;
    return li;
  }));
}
$('vaccForm').addEventListener('input', renderVaccines);
$('vaccForm').addEventListener('submit', (e) => e.preventDefault());
$('vaccForm').birth.max = new Date().toISOString().slice(0, 10);

// ---------- Врачи и запись ----------

function renderDoctors() {
  $('doctors-list').replaceChildren(...DOCTORS.map((d) => {
    const el = document.createElement('article');
    el.className = 'doctor';
    const initials = d.name.split(' ').map((w) => w[0]).join('');
    const days = d.days.map((n) => WEEKDAYS[n]).join(', ');
    el.innerHTML = `<div class="ava">${initials}</div><h3>${d.name}</h3><p>${d.role}</p><p>${days}, ${d.from}:00–${d.to}:00</p>`;
    return el;
  }));
  $('doctor').innerHTML = DOCTORS.map((d) => `<option value="${d.id}">${d.name} — ${d.role}</option>`).join('');
}

let slot = null;
function renderSlots() {
  const doctor = DOCTORS.find((d) => d.id === $('doctor').value);
  const days = freeSlots(doctor, new Date(), 7);
  slot = null;
  $('chosen').textContent = 'Время не выбрано';
  if (!days.length) {
    $('slots').innerHTML = '<p class="muted">На ближайшую неделю свободного времени нет, выберите другого врача.</p>';
    return;
  }
  $('slots').replaceChildren(...days.map((day) => {
    const box = document.createElement('div');
    box.className = 'slot-day';
    const h = document.createElement('h4');
    h.textContent = human(day.date);
    const row = document.createElement('div');
    for (const hour of day.hours) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = `${hour}:00`;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        for (const other of document.querySelectorAll('.slot')) other.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        slot = { date: day.date, hour, doctor: doctor.name };
        $('chosen').textContent = `${doctor.name}: ${human(day.date)}, ${hour}:00`;
        document.querySelector('.err[data-for="slot"]').textContent = '';
      });
      row.append(b);
    }
    box.append(h, row);
    return box;
  }));
}
$('doctor').addEventListener('change', renderSlots);

const form = $('bookForm');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = { owner: form.owner.value, phone: form.phone.value, petName: form.petName.value, slot };
  const errors = validateBooking(data);
  for (const p of document.querySelectorAll('.err')) {
    const key = p.dataset.for;
    p.textContent = errors[key] ?? '';
    if (form[key]) form[key].setAttribute('aria-invalid', String(Boolean(errors[key])));
  }
  if (Object.keys(errors).length) {
    if (errors.slot && Object.keys(errors).length === 1) $('slots').scrollIntoView({ block: 'center' });
    else form[Object.keys(errors).find((k) => form[k])]?.focus();
    return;
  }
  // Демо: запись не уходит на сервер, а сохраняется в браузере.
  try {
    const list = JSON.parse(localStorage.getItem('lapa-bookings') ?? '[]');
    list.push({ ...data, phone: normalizePhone(data.phone), note: form.note.value, at: new Date().toISOString() });
    localStorage.setItem('lapa-bookings', JSON.stringify(list));
  } catch {
    // приватный режим
  }
  const ok = $('bookOk');
  ok.hidden = false;
  ok.textContent = `${data.petName.trim()} записан(а) к врачу ${slot.doctor} на ${human(slot.date)}, ${slot.hour}:00. Перезвоним для подтверждения.`;
  form.reset();
  renderSlots();
});

// ---------- Срочно ----------

$('urgentList').replaceChildren(...URGENT.map((t) => Object.assign(document.createElement('li'), { textContent: t })));

renderChips();
renderPrices();
renderVaccines();
renderDoctors();
renderSlots();
