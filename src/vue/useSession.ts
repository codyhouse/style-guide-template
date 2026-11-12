import { markRaw, shallowRef, triggerRef } from 'vue';
import { tryOnScopeDispose } from '@vueuse/core';
import type { Session } from '../app/session.js';

/** Session as a ref that re-triggers on every change; markRaw because its private fields break proxies. */
export function useSession(session: Session) {
  const live = shallowRef(markRaw(session));
  tryOnScopeDispose(session.subscribe(() => triggerRef(live)));
  return live;
}
