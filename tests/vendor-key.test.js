import { test } from 'vitest';
import assert from 'node:assert/strict';
import { vendorKey } from '../src/lib/vendor-key.js';

test('reverse-domain vendor key from the hosted URL', () => {
  assert.equal(vendorKey('https://styleguide.example.com'), 'com.example.styleguide');
  assert.equal(vendorKey('https://example.com/path'), 'com.example');
  assert.equal(vendorKey('http://localhost:8000'), 'localhost');
});
