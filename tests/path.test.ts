import { test } from 'vitest';
import assert from 'node:assert/strict';
import { extension, fileName } from '../src/lib/path.js';

test('file name and extension', () => {
  assert.equal(fileName('logos/a.svg'), 'a.svg');
  assert.equal(fileName('a.svg'), 'a.svg');
  assert.equal(extension('fonts/Inter.WOFF2'), 'woff2');
  assert.equal(extension('library/README'), '');
  assert.equal(extension('a.b/c'), '');
});
