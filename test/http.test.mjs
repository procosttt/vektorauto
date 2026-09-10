import assert from 'node:assert/strict';
import test from 'node:test';
import { contentType } from '../lib/http.mjs';

test('serves HTML as a web page instead of a download', () => {
  assert.equal(contentType('index.html'), 'text/html; charset=utf-8');
});
