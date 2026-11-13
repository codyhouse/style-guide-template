import { markRaw, shallowRef, triggerRef } from 'vue';
import { tryOnScopeDispose } from '@vueuse/core';
import type { Session } from '../app/session.js';

export function useSession(session: Session) {
  const live = shallowRef(markRaw(session));
  tryOnScopeDispose(session.subscribe(() => triggerRef(live)));
  return live;
}
