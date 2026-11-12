import { onMounted, onUnmounted, shallowRef } from 'vue';
import type { Session } from '../app/session.js';

export function useSession(session: Session) {
  const revision = shallowRef(0);
  let unsubscribe: (() => void) | undefined;
  onMounted(() => {
    unsubscribe = session.subscribe(() => revision.value++);
  });
  onUnmounted(() => unsubscribe?.());
  return revision;
}
