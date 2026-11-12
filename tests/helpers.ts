import assert from 'node:assert/strict';
import type { Tokens } from '../src/lib/types.js';

/** The value, after asserting it exists: a missing value fails the test with `what` in the message. */
export function present<T>(value: T | null | undefined, what = 'value'): T {
  assert.ok(value !== null && value !== undefined, `${what} is missing`);
  return value;
}

export const token = (tokens: Tokens, path: string) => present(tokens.get(path), path);
