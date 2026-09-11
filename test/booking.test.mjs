import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDateChoices } from '../booking.js';

test('builds five consecutive visit dates starting tomorrow', () => {
  const choices = buildDateChoices(new Date(2026, 8, 11, 12));

  assert.deepEqual(choices.map(({ value }) => value), [
    '2026-09-12',
    '2026-09-13',
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
  ]);
});
