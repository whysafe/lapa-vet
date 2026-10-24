// Логика сайта клиники без DOM: прайс, график прививок, свободные слоты записи, проверка формы.

export const SERVICES = [
  { id: 'exam', name: 'Первичный осмотр', price: 1200, pets: ['cat', 'dog', 'exotic'], group: 'Приём' },
  { id: 'repeat', name: 'Повторный приём', price: 800, pets: ['cat', 'dog', 'exotic'], group: 'Приём' },
  { id: 'vacc-cat', name: 'Комплексная прививка кошке', price: 1900, pets: ['cat'], group: 'Прививки' },
  { id: 'vacc-dog', name: 'Комплексная прививка собаке', price: 2300, pets: ['dog'], group: 'Прививки' },
  { id: 'rabies', name: 'Прививка от бешенства', price: 900, pets: ['cat', 'dog'], group: 'Прививки' },
  { id: 'chip', name: 'Чипирование с внесением в базу', price: 1500, pets: ['cat', 'dog'], group: 'Прививки' },
  { id: 'castr-cat', name: 'Кастрация кота', price: 3500, pets: ['cat'], group: 'Операции' },
  { id: 'ster-cat', name: 'Стерилизация кошки', price: 6500, pets: ['cat'], group: 'Операции' },
  { id: 'ster-dog', name: 'Стерилизация собаки до 10 кг', price: 9000, pets: ['dog'], group: 'Операции' },
  { id: 'teeth', name: 'Ультразвуковая чистка зубов', price: 4200, pets: ['cat', 'dog'], group: 'Стоматология' },
  { id: 'claws', name: 'Стрижка когтей', price: 400, pets: ['cat', 'dog', 'exotic'], group: 'Уход' },
  { id: 'exotic-exam', name: 'Осмотр птицы, грызуна или рептилии', price: 1500, pets: ['exotic'], group: 'Приём' },
  { id: 'blood', name: 'Общий анализ крови', price: 950, pets: ['cat', 'dog', 'exotic'], group: 'Анализы' },
  { id: 'us', name: 'УЗИ брюшной полости', price: 2200, pets: ['cat', 'dog'], group: 'Анализы' },
];

export const PETS = { cat: 'Кошки', dog: 'Собаки', exotic: 'Экзотика' };

export function filterServices(services, pet = 'all', query = '') {
  const q = query.trim().toLowerCase();
  return services.filter((s) => (pet === 'all' || s.pets.includes(pet)) && (!q || s.name.toLowerCase().includes(q)));
}

/** Группировка для прайса: { 'Приём': [...], 'Прививки': [...] } в порядке появления групп. */
export function groupServices(services) {
  const out = {};
  for (const s of services) (out[s.group] ??= []).push(s);
  return out;
}

const DAY = 86_400_000;

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Типовой график прививок для котёнка или щенка по дате рождения
 * (по схемам основных производителей вакцин; итоговый график всегда уточняет врач).
 */
const PLANS = {
  cat: [
    { week: 8, title: 'Первая комплексная прививка', note: 'панлейкопения, калицивироз, ринотрахеит' },
    { week: 12, title: 'Ревакцинация и бешенство', note: 'вторая комплексная и прививка от бешенства' },
    { week: 64, title: 'Ежегодная ревакцинация', note: 'дальше раз в год' },
  ],
  dog: [
    { week: 8, title: 'Первая комплексная прививка', note: 'чума, парвовироз, аденовироз, парагрипп' },
    { week: 12, title: 'Ревакцинация и бешенство', note: 'вторая комплексная, лептоспироз и бешенство' },
    { week: 16, title: 'Третья комплексная', note: 'для щенков из питомников с высоким риском' },
    { week: 64, title: 'Ежегодная ревакцинация', note: 'дальше раз в год' },
  ],
};

/** За 10 дней до прививки нужно дать средство от глистов. */
export const DEWORM_DAYS_BEFORE = 10;

export function vaccinationPlan(kind, birthDate, today = new Date()) {
  const plan = PLANS[kind];
  if (!plan) throw new Error(`Неизвестный вид: ${kind}`);
  const birth = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birth > now) throw new Error('Дата рождения в будущем');
  return plan.map((step) => {
    const date = addDays(birth, step.week * 7);
    const days = Math.round((date - now) / DAY);
    return {
      ...step,
      date: iso(date),
      deworm: iso(addDays(date, -DEWORM_DAYS_BEFORE)),
      status: days < -14 ? 'overdue' : days < 0 ? 'now' : days <= 14 ? 'soon' : 'later',
      days,
    };
  });
}

export const DOCTORS = [
  { id: 'ivanova', name: 'Ольга Иванова', role: 'терапевт, кошки и собаки', days: [1, 2, 3, 4, 5], from: 9, to: 15 },
  { id: 'petrov', name: 'Андрей Петров', role: 'хирург', days: [1, 3, 5], from: 12, to: 20 },
  { id: 'kim', name: 'Мария Ким', role: 'экзотические животные', days: [2, 4, 6], from: 10, to: 18 },
  { id: 'duty', name: 'Дежурный врач', role: 'приём по выходным', days: [0, 6], from: 10, to: 16 },
];

/** Детерминированный «занятый» слот: в демо расписание выглядит живым и одинаковым у всех. */
function busy(doctorId, date, hour) {
  let h = 2166136261;
  for (const ch of `${doctorId}|${date}|${hour}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 10 < 4; // примерно 40% слотов заняты
}

/** Свободные часовые слоты врача на ближайшие days дней; сегодня — только будущие часы. */
export function freeSlots(doctor, now = new Date(), days = 7) {
  const out = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(now, d);
    if (!doctor.days.includes(date.getDay())) continue;
    const key = iso(date);
    const hours = [];
    for (let h = doctor.from; h < doctor.to; h++) {
      if (d === 0 && h <= now.getHours()) continue;
      if (!busy(doctor.id, key, h)) hours.push(h);
    }
    if (hours.length) out.push({ date: key, weekday: date.getDay(), hours });
  }
  return out;
}

export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits[0] === '9') return `+7${digits}`;
  return null;
}

export function validateBooking({ owner, phone, petName, slot }) {
  const errors = {};
  if (!owner || owner.trim().length < 2) errors.owner = 'Как к вам обращаться?';
  if (!normalizePhone(phone)) errors.phone = 'Телефон в формате +7 900 000-00-00';
  if (!petName || !petName.trim()) errors.petName = 'Как зовут питомца?';
  if (!slot) errors.slot = 'Выберите время приёма';
  return errors;
}

/** Симптомы, при которых нельзя ждать планового приёма. */
export const URGENT = [
  'Не ест больше суток (кошка) или двух суток (собака)',
  'Рвота или понос с кровью, или больше трёх раз за день',
  'Тяжело дышит, дышит открытым ртом (кошка)',
  'Не может помочиться или ходит в лоток без результата',
  'Съел что-то опасное: лекарства, крысиный яд, батарейку, нитку',
  'Травма, кровотечение, падение с высоты',
  'Вздутый твёрдый живот у собаки, безуспешные позывы к рвоте',
  'Судороги или потеря сознания',
];
