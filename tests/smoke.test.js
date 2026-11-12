import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync } from '../js/vendor/fflate.js';

test('vendored fflate round-trips a file', () => {
  const zip = zipSync({ 'a.txt': new TextEncoder().encode('hi') });
  assert.equal(new TextDecoder().decode(unzipSync(zip)['a.txt']), 'hi');
});
