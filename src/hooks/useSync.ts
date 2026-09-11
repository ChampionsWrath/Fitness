import { useSyncExternalStore } from 'react';
import { sync, type SyncStatus } from '../sync/engine';

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => sync.subscribe(() => fn()),
    () => sync.getStatus(),
    () => sync.getStatus(),
  );
}
