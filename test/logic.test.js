import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCTORS, SERVICES, filterServices, freeSlots, groupServices, normalizePhone, vaccinationPlan, validateBooking,
} from '../js/logic.js';

test('price list filters by pet and search text', () => {
  assert.ok(filterServices(SERVICES, 'cat').every((s) => s.pets.includes('cat')));
  assert.ok(!filterServices(SERVICES, 'exotic').some((s) => s.id === 'castr-cat'));
  assert.deepEqual(filterServices(SERVICES, 'all', 'ПРИВИВКА').map((s) => s.id), ['vacc-cat', 'vacc-dog', 'rabies']);
  assert.deepEqual(filterServices(SERVICES, 'exotic', 'стерилизация'), []);
});

test('groups keep the order of first appearance', () => {
  assert.deepEqual(Object.keys(groupServices(SERVICES)), ['Приём', 'Прививки', 'Операции', 'Стоматология', 'Уход', 'Анализы']);
});

test('kitten vaccination plan: 8 and 12 weeks, then yearly', () => {
  const plan = vaccinationPlan('cat', new Date(2026, 8, 1), new Date(2026, 9, 24));
  assert.deepEqual(plan.map((p) => p.date), ['2026-10-27', '2026-11-24', '2027-11-23']);
  assert.equal(plan[0].status, 'soon');
  assert.equal(plan[0].days, 3);
  assert.equal(plan[0].deworm, '2026-10-17');
  assert.equal(plan[2].status, 'later');
});

test('puppy plan has a third shot at 16 weeks and statuses follow today', () => {
  const plan = vaccinationPlan('dog', new Date(2026, 5, 1), new Date(2026, 9, 24));
  assert.equal(plan.length, 4);
  assert.deepEqual(plan.map((p) => p.status), ['overdue', 'overdue', 'overdue', 'later']);
  const fresh = vaccinationPlan('dog', new Date(2026, 9, 24), new Date(2026, 9, 24));
  assert.equal(fresh[0].days, 56);
});

test('vaccination plan rejects future birth dates and unknown animals', () => {
  assert.throws(() => vaccinationPlan('cat', new Date(2030, 0, 1), new Date(2026, 9, 24)), /в будущем/);
  assert.throws(() => vaccinationPlan('parrot', new Date(2026, 0, 1)), /Неизвестный вид/);
});

test('free slots only on working days, within hours, never in the past', () => {
  const surgeon = DOCTORS.find((d) => d.id === 'petrov');
  const now = new Date(2026, 9, 26, 14, 30); // понедельник, 14:30
  const slots = freeSlots(surgeon, now, 7);
  assert.ok(slots.length > 0);
  for (const day of slots) {
    assert.ok(surgeon.days.includes(day.weekday), day.date);
    assert.ok(day.hours.every((h) => h >= 12 && h < 20));
  }
  const today = slots.find((d) => d.date === '2026-10-26');
  if (today) assert.ok(today.hours.every((h) => h > 14));
});

test('slots are the same on every call (deterministic demo schedule)', () => {
  const now = new Date(2026, 9, 26, 8);
  assert.deepEqual(freeSlots(DOCTORS[0], now), freeSlots(DOCTORS[0], now));
  const total = freeSlots(DOCTORS[0], now, 5).reduce((n, d) => n + d.hours.length, 0);
  assert.ok(total > 10 && total < 30, `free hours: ${total}`);
});

test('phone and booking validation', () => {
  assert.equal(normalizePhone('8 (916) 123-45-67'), '+79161234567');
  assert.equal(normalizePhone('123'), null);
  assert.deepEqual(Object.keys(validateBooking({})).sort(), ['owner', 'petName', 'phone', 'slot']);
  assert.deepEqual(validateBooking({ owner: 'Анна', phone: '+79161234567', petName: 'Барсик', slot: 'x' }), {});
});
