import assert from 'node:assert/strict';
import test from 'node:test';
import { easeScroll, scrollDuration } from '../motion.js';

test('keeps anchor scroll duration between 0.8 and 1.6 seconds', () => {
  assert.equal(scrollDuration(200), 800);
  assert.equal(scrollDuration(2500), 1050);
  assert.equal(scrollDuration(5000), 1600);
});

test('uses a smooth ease-in-out curve', () => {
  assert.equal(easeScroll(0), 0);
  assert.equal(easeScroll(0.5), 0.5);
  assert.equal(easeScroll(1), 1);
  assert.ok(easeScroll(0.25) < 0.25);
  assert.ok(easeScroll(0.75) > 0.75);
});
